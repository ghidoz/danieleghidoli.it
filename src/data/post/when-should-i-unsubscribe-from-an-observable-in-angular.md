---
title: "When should I unsubscribe from an Observable in Angular?"
publishDate: 2020-10-30T00:00:00Z
excerpt: It's often said that you should always unsubscribe from Observables in Angular, but is it truly necessary in every case? Let's find out!
category: "RxJS"
tags: 
  - "observable"
  - "takeuntil"
  - "unsubscribe"
image: "~/assets/images/mailbox.jpg"
---

You have probably heard many times that it's a good practice to **unsubscribe** from an `Observable` after you subscribe to it in your Angular application. But is it always the case? Do you really need to do it?

The truth is that some Observables don't need you to unsubscribe from them. Let's understand which ones so that we don't write useless code, creating overhead.

## Why do we need to unsubscribe?

The difference between a `Promise` and an `Observable` is that the first just emits one value and completes, while the latter opens a stream of events and keep listening until we unsubscribe from it. That subscription keeps going even after the Angular component doesn't exist anymore.

Imagine that we have a route `/user` with a `UserComponent` where we subscribe to an `Observable` that emits an event every time the user object changes. Something like this:

```typescript
ngOnInit() {
  this.userService.userChanged.subscribe(user => {
    console.log(user);
  });
}
```

Now, if we enter the `/user` route, the component will subscribe to `userChanged`. Let's pretend that we go back to the application home page and then we navigate again to `/user`. If we are navigating from a menu and we are not refreshing the page, every time we enter the `UserComponent`, a new subscription is created.

What do you think will happen if we trigger that `Observable`, sending an event to `userChanged`? How many `console.log` will you see? As many as the number of times we entered the page! Every time, in fact, a new subscription is created, without destroying the previous ones. This will create memory leaks in your app and it will affect its performances.

## The solution

As you probably already know, the solution is unsubscribing from every `Observable` that we subscribed to, and we do that in the `ngOnDestroy` method, called just before the component gets destroyed.

There are a few ways for accomplishing it.

You can save the `Subscription` into a property in the component:

```typescript
private userSubscription: Subscription;

ngOnInit() {
  this.userSubscription = this.userService.userChanged.subscribe(user => {
    console.log(user);
  });
}

ngOnDestroy() {
  this.userSubscription.unsubscribe()
}
```

You can collect all the subscriptions into an array:

```typescript
private subscriptions: Subscription[] = [];

ngOnInit() {
  this.userSubscription.push( 
    this.userService.userChanged.subscribe(user => {
      console.log(user);
    });
  );
  this.userSubscription.push( 
    this.anotherService.something.subscribe();
  );
}

ngOnDestroy() {
  this.userSubscription.forEach(s => s.unsubscribe());
}
```

You can use the `takeUntil` pipeable operator with a `Subject`:

```typescript
private unsubscribe$ = new Subject();

ngOnInit() {
  this.userService.userChanged.pipe(
    takeUntil(this.unsubscribe$)
  ).subscribe(user => {
    console.log(user);
  });
}

ngOnDestroy() {
  this.unsubscribe$.next();
  this.unsubscribe$.complete();
}
```

In this case, the `takeUntil` operator will complete the observable when the `unsubscribe$` `Subject` emits its value. Note that at **line 13** we also complete the `Subject`, in order not to leave it unsubscribed.

Finally you can use the `async` pipe:

```typescript
// in the component:

user$: Observable<User>;

ngOnInit() {
  this.user$ = this.userService.userChanged;
}

// in the template:

<div *ngIf="user$ | async as user">{{user.name}}</div>
```

The `async` pipe automatically subscribes to the `Observable` and unsubscribes when the component gets destroyed.

## When do we need to unsubscribe?

Ok, we've learned how to unsubscribe, but what kind of Observables actually need us to do it?

Almost every `Observable`, except for a few ones managed by Angular:

- The `HttpClient` Observables: since they will only return one value, they are implemented for completing just after they fire the first event, like a Promise.
- The `ActivatedRoute` Observables like `route.params`: they are insulated from the Router itself. The Router destroys a routed component when it is no longer needed and the injected `ActivatedRoute` dies with it.

Also, you don't need to unsubscribe from Observables that you subscribe to in the `AppComponent`, as it never gets destroyed.

You always have to unsubscribe from:

- Any `Observable` or `Subject` you created manually.
- `FormGroup` observables like `form.valueChanges` and `form.statusChanges`
- Observables of `Renderer2` service like `renderer2.listen`

In case you have doubts, you can always unsubscribe, just in case.
