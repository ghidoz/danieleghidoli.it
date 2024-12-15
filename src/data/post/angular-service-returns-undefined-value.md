---
title: "Why my Angular service doesn't return the assigned value?"
publishDate: 2020-10-29T00:00:00Z
excerpt: In Angular, assigning a value to a service property in one component may not reflect in another due to a simple issue that can waste a lot of time.
category: "bugs"
tags: 
  - "service"
  - "singleton"
  - "undefined"
image: "~/assets/images/crashed-plane.jpg"
---

Sometimes it can happen that you **assign a value** on a **service**'s property in your Angular app from a component and, when you try to get that value from a different component, it just returns `undefined` or the default value in your constructor! How can this be possible, if you just set it? There may be a very simple reason, that can make you waste a lot of time.

Take this simple service:

```typescript
@Injectable()
export class SharedService {
  value: string;
}
```

From component A we set the value:

```typescript
constructor(private sharedService: SharedService){}

ngOnInit() {
  this.sharedService.value = 'Hello!';
}
```

From component B, we simply get it and console.log it:

```typescript
constructor(private sharedService: SharedService){}

ngOnInit() {
  console.log(this.sharedService.value);
}
```

What would you expect to log? It should just print `Hello!`, right? Well, if you misconfigured your application, it may just print `undefined`, apparently with no reason.

Consider an app structure like this:

```typescript
- ModuleA
-- ComponentA
- ModuleB
-- ComponentB
- CoreModule
-- SharedService
-- SharedComponent
- AppModule
```

Let's say we decided to create a `CoreModule` to wrap all the shared services and components that we are going to use in our app. It will look like this:

```typescript
@NgModule({
  declarations: [SharedComponent],
  exports: [SharedComponent],
  providers: [SharedService]
])
export class CoreModule { }
```

Now, in `ComponentA` and `ComponentB` we'll need to use that `SharedComponent`, so we decide to import the `CoreModule` directly into both `ModuleA` and `ModuleB`, right?

Here's when the mess will begin!

Since we are providing the `SharedService` inside the `CoreModule`, this will be provided also to both `ComponentA` and `ComponentB`, but it will not be the same instance!

When accessing `SharedService` from one component, we'll be provided with an instance of it where we set the value. But when we'll access the same service from the other component, we'll be working on a different instance where the value has not been set, thus returning `undefined`.

The problem here is that a service should always be a _singleton_, in order to prevent this kind of unexpected behaviors. Providing it in two different components will create two different instances of that.

In order to solve this, we have many options:

1. Just provide it in the `AppModule`, so that it will be available to the entire app as a singleton.
2. Edit the `CoreModule` in order to provide the services just once, like this:

```typescript
@NgModule({
  declarations: [SharedComponent],
  exports: [SharedComponent]
])
export class CoreModule {

  static forRoot(): ModuleWithProviders<CoreModule> {
    return {
      ngModule: CoreModule,
      providers: [
        SharedService
      ]
    };
  }

  constructor (@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error(
        'CoreModule is already loaded. Import it in the AppModule only');
    }
  }

}
```

In this way, you have first to import the `CoreModule` from the `AppModule` like this:

```typescript
@NgModule({
  // ...
  imports: [
    // ...
    CoreModule.forRoot()
  ]
})
export class AppModule { }
```

Then you can import it from any other module that needs its components, with no worries of providing the service multiple times:

```typescript
@NgModule({
  // ...
  imports: [
    // ...
    CoreModule
  ]
})
export class AnotherModule { }
```

From Angular 6.0, there's a new way for importing services: instead of providing it manually, you can just add `providedIn: 'root'` to the `Injectable` decorator:

```typescript
@Injectable(
  providedIn: 'root'
)
export class SharedService {
  value: string;
}
```

This is considered the preferred way for providing a service, so that you don't forget to provide it and you don't risk to provide it multiple times.

Just note that if you use `providedIn: 'root'` **AND** you also provide it in a module, you still have the multiple instance problem. **Just pick one!**

Now try to access your service from different components in different modules and you can bet you'll get the correct value.
