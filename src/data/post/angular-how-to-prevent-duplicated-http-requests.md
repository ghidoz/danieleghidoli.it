---
title: "Angular: How to prevent duplicated HTTP requests"
publishDate: 2020-10-28T00:00:00Z
excerpt: To prevent duplicate HTTP requests when multiple components call the same service, the first response can be shared with all subscribers using specific techniques.
category: "RxJS"
tags: 
  - "cache"
  - "observable"
image: "~/assets/images/angkor-wat.jpg"
---

What happens if two different components **call the same service** which makes an HTTP call to an API? You will have **two duplicated calls**! Is it possible to share the first response with all subscribers to prevent duplicate HTTP requests? Yes, it is! Let's see how.

Here's the method in our `SharedService`:

```typescript
getSomeData(): Observable<any> {
  return this.http.get<any>('some/endpoint');
}
```

Every time we call it, we'll make a **new HTTP request** to the server.

A first solution is simply **caching the response**:

```typescript
private cache: any;

// ...

getSomeData(): Observable<any> {
  if (this.cache) {
    return of(this.cache);
  }
  return this.http.get<any>('some/endpoint').pipe(
    tap(res => this.cache = res)
  );
}
```

Now, the second time we subscribe to the method, we will have the response instantly and no other call will be fired.

But this doesn't solve our problem, in case two components subscribe to the method at the same time. In fact, when the second one subscribes, we don't have a cached value yet, so it will make a second call.

In order to solve this problem, we have to **cache the observable itself** and make it **sharable**:

```typescript
private cache: any;
private cachedObservable: Observable<any>;

// ...

getSomeData(): Observable<any> {
  let observable: Observable<any>;
  if (this.cache) {
    observable = of(this.cache);
  }  else if (this.cachedObservable) {
    observable = this.cachedObservable;
  } else {
    this.cachedObservable = this.http.get<any>('some/endpoint')
      .pipe(
        tap(res => this.cache = res),
        share(),
        finalize(() => this.cachedObservable = null)
      );
    observable = this.cachedObservable;
  }
  return observable;
}
```

Now, if a component subscribes to the same method and a cached value is not available, we'll check if there is a `cachedObservable`. In that case, we just subscribe to it. When it will complete, both of the components will get the result **at the same time**, with just one call.

Note the `share()` method at **line 15** that makes the `Observable` sharable among multiple subscribers, while at **line 16** we set the `cachedObservable` to `null` when the call completes because we don't want any other subscriber. New subscribers will just get the cached value from now on.
