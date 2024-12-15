---
title: "Testing an Angular Component with Mock Services"
publishDate: 2016-11-06T00:00:00Z
excerpt: When testing a component with service dependencies, it's best to mock the services to isolate the component and avoid issues, especially with server interactions. This article explores two methods for mocking services.
category: "testing"
tags: 
  - "mock"
  - "observable"
  - "spyon"
image: "~/assets/images/mock-service.jpg"
---

When testing a component with **service dependencies**, the best practice is **mocking them**, in order to test the component in an isolated environment. In fact, our purpose is testing the component, not the services, that can be trouble, especially if they try to interact with a server.  
In this article we will see the two methods for mocking services.

Let's say that we have to test this simple component:

```typescript
@Component({
  selector: 'app-hello',
  template: '<h3>Hello {{user.name}}</h3>'
})
export class HelloComponent implements OnInit {

  public user: User;

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.userService.me().subscribe((user: User) => {
      this.user = user;
    });
  }
}
```

## Mocking the Service class

The first option we have is creating a **mock class** that replaces the original service:

```typescript
const USER_OBJECT: User = new User(42, 'Daniele');

class MockUser {

  public me(): Observable<User> {
    return Observable.of(USER_OBJECT);
  }
}
```

We have to mock all the methods used by the component, otherwise we'll get an error. In this case, we just neeed to create a mock `me()` method that return a static Observable with our fake `User` object that the real service would have returned. Putting the `User` object inside a constant will let us to access it later in the tests.

We can then **provide** the mock when configuring the testing module:

```typescript
let component: HelloComponent;
let userService: UserService;

beforeEach(() => {
  TestBed.configureTestingModule({
    declarations: [
      HelloComponent
    ],
    providers: [
      {provide: UserService, useClass: MockUser}
    ]
  });
  component = TestBed.createComponent(HelloComponent).componentInstance;
  userService = TestBed.get(UserService);
});
```

Thanks to `TestBed.get`, we inject the `UserService`, that is automatically replaced with our mock service.

Now we can test the component!

```typescript
it('should set the user', () => {
  component.ngOnInit();
  expect(component.user).toBe(USER_OBJECT);
}
```

## Mocking the method

Instead of mocking the entire `UserService`, we can inject the original service, mocking only the concerned method thanks to `spyOn`. In this case, we don't need to provide the `MockUser`, but we can just do as follow:

```typescript
let component: HelloComponent;
let userService: UserService;

beforeEach(() => {
  TestBed.configureTestingModule({
    declarations: [
      HelloComponent
    ],
    providers: [
      UserService
    ]
  });
  component = TestBed.createComponent(HelloComponent).componentInstance;
  userService = TestBed.get(UserService);
  spyOn(userService, 'me').and.returnValue(Observable.of(USER_OBJECT));
});
```

The only side effect of this method is that, if the original `UserService` depends on another service, we will need to add it to the `providers` array, otherwise the testing module will not find it.

## Checking that a method is called

One of the **most common mistakes** that I commit sometimes and makes me waste time debugging is just a silly oversight. As we have just seen, when you spy a method using `spyOn`, you can return a value, but somethimes you are only interested in checking that the method is called, preserving the original returned value.

Imagine that we are mocking the `UserService` as we did before with the `MockUser`, but we also would like to check that the `userService.me()` is called.

Since we are already mocking the result of the `me()` method, we don't need to return a value, so you may be tempted to do just this:

```typescript
spyOn(userService, 'me');
```

The problem is that it will **block the execution** of `me()`! It won't return the Observable, preventing the `subscribe()` method from being called by our component.

If you are checking that the method is actually called, this test will pass:

```typescript
it('should set the user', () => {
  component.ngOnInit();
  expect(userService.me).toHaveBeenCalled();
}
```

but not this:

```typescript
it('should set the user', () => {
  component.ngOnInit();
  expect(component.user).toBe(USER_OBJECT);
}
```

since everything in the `subscribe()` will not be executed!

The correct solution is:

```typescript
spyOn(userService, 'me').and.callThrough();
```

This will actually call the method and return the mock Observable, allowing the callback of the `subscribe()` to be fired.

Be careful with this, because it will spare you a lot of time!
