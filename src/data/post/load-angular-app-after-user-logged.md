---
title: "How to load an Angular app just after the user is logged"
publishDate: 2020-10-28T00:00:00Z
excerpt: No matter the authentication method in your Angular app, you'll always face the challenge of initializing views and components only after the user's info is fully loaded. Let's explore how to solve this!
category: "RxJS"
tags: 
  - "login"
  - "replaysubject"
  - "subject"
image: "~/assets/images/doors-colors.jpg"
---

Whichever authentication method you use for logging in users in your Angular application, there will always be a problem to solve: starting your app and initialize views and components only **after the user info is fully loaded**. Let's see how to do it!

## 1\. Set up the logged event

Let's say you have an `AuthService` that deals with login and saves the access token into `localStorage`. When the user comes back to the app or just refreshes it, we'll need to get the user info from our API and prevent the entire application to load until the call is finished.

After the user login, we can call the following method:

```typescript
private setUserAndToken(response: AuthResponse) {
  this.userService.user = response.user;
  localStorage.setItem('access_token', response.auth.access_token);
  this.logged.next(true);
}
```

We save the user object into the `UserService` and the token into `localStorage`. Then, we notify the app that the user is logged.

The `logged` property is a `Subject`, that can emit an event every time the user logs in or logs out:

```typescript
private logged = new ReplaySubject<boolean>(1);
isLogged = this.logged.asObservable();
```

Using a `ReplaySubject`, we will be able to subscribe to it even after the event has been sent, and still getting the last value. You can learn [more about the ReplySubject in this article](https://blog.danieleghidoli.it/2017/09/11/subscribe-rxjs-event-after-emitted-angular/).

Moreover, we export it as an `Observable` for external access.

From the `AppComponent`, we can now add a listener to the user logged status:

```typescript
this.authService.isLogged.subscribe(logged => {
  this.isLogged = logged;
});
```

Now, what will happen if we reload the page? We have to read the access token from the `localStorage` and inform our app that the user is logged, right? We can do it with this method on the `AuthService`:

```typescript
checkStatus() {
  if (localStorage.getItem('access_token')) {
    this.logged.next(true);
  } else {
    this.logged.next(false);
  }
}
```

Just call it from the `AppComponent`, after subscribing to `isLogged`.

## 2\. Get the user info

Knowing that the user is logged is not enough for us, we also want to get his info from an endpoint. We can do this right after we checked if the user is logged in the `AppComponent`:

```typescript
this.authService.isLogged.subscribe(logged => {
  this.isLogged = logged;
  if (logged) {
    this.userService.getCurrentUser().subscribe();
  }
});
```

While the `getCurrentUser()` method of the `UserService` will do something like this:

```typescript
getCurrentUser(): Observable<User> {
  return this.http.get<User>('/me').pipe(
    tap(user => this.user = user)
  );
}
```

After getting the user from the endpoint (assuming you have an Http Interceptor that adds an Authorization header with the access token), we set it in the `UserService` class for later access.

## 3\. Load the components only when the user is actually logged in

Here's come the tricky part: how can we prevent the entire app to load, until we are sure that the user info has been loaded?

Let's say we have an `HeaderComponent` where we want to access to `this.userService.user` in order to show the user name. It will display nothing or it will throw an error if the `getCurrentUser()` method hasn't finished yet.

The solution is a simple `*ngIf` in the `AppComponent` template:

```html
<div *ngIf="!loading">
  <app-header></app-header>
  <router-outlet ></router-outlet>
</div>
```

Of course, we need to add the loading property to the `AppComponent` controller and set it to `false` right after the user info is loaded:

```typescript
// ...
loading = true;

// ...

this.authService.isLogged.subscribe(logged => {
  this.isLogged = logged;
  if (logged) {
    this.userService.getCurrentUser().subscribe(() => {
      this.loading = false;
    });
  }
});
```

As soon as `getCurrentUser()` get the user info and set it in the service, we enable the router to load the first route's template. From now on, anytime we'll call `this.userService.user`, we'll be sure to find a value.

## Let's wrap things up

The `AuthService` (with a bit of refactoring) will look like this:

```typescript
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private accessToken: string;
  private logged = new ReplaySubject<boolean>(1);
  isLogged = this.logged.asObservable();

  constructor(private userService: UserService) {}

  login(data: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/login', data).pipe(
      tap(res => this.setUserAndToken(res))
    );
  }

  private setUserAndToken(response: AuthResponse) {
    this.userService.user = response.user;
    this.token = response.auth.access_token;
    this.logged.next(true);
  }

  set token(token: string) {
    this.accessToken = token;
    localStorage.setItem('access_token', token);
  }

  get token(): string {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('access_token');
    }
    return this.accessToken;
  }

  checkStatus() {
    if (this.token) {
      this.logged.next(true);
    } else {
      this.logged.next(false);
    }
  }
}
```

And this is the `AppComponent`:

```typescript
@Component({
  selector: 'app-root',
  template: `
    <div *ngIf="!loading">
      <app-header></app-header>
      <router-outlet ></router-outlet>
    </div>
    <div *ngIf="loading">Loading...</div>
  `
})
export class AppComponent implements OnInit {

  loading = true;

  constructor(private userService: UserService,
              private authService: AuthService) {}

  ngOnInit() {
    this.authService.isLogged.subscribe(logged => {
      this.isLogged = logged;
      if (logged) {
        this.userService.getCurrentUser().subscribe(() => {
          this.loading = false;
        });
      }
    });
    this.authService.checkStatus(); // don't forget this!
  }
}

```

Easy peasy, right? With a simple `*ngIf` we can put in pause the entire app until we get the user info, which then will be available for the entire app.
