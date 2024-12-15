---
title: "How to subscribe to RxJS event after it has been already emitted"
publishDate: 2017-09-11T00:00:00Z
excerpt: "Observables, Subjects, and EventEmitters are powerful, but they share a common issue: if you subscribe after an event has already been emitted, you'll miss it!"
category: "RxJS"
tags: 
  - "replaysubject"
  - "subject"
image: "~/assets/images/replay.jpg"
---

Observables, Subjects and EventEmitters are amazing, I love them. But they have a common problem: what if you subscribe to one of them when the event has been **already emitted**? You would lose it!

Let's see an example:

```typescript
let subject: Subject<string> = new Subject(); 
subject.next('test');
subject.subscribe((event) => { 
  console.log(event); 
});
```

In this case, we are using a `Subject`, but it could be an `EventEmitter` or an `Observable` as well. What we are doing is subscribing the event after it has been emitted. What happens so? Absolutely **nothing**! Since it has not subscribed yet when we emit it, the **event is lost** and, when we subscribe it, the event is not emitted again.

What is the solution? Of course, we should subscribe it before emitting the event, but this is not always possible. Think about having this situation, for example:

- The main AppComponent emits the event.
- The route `/test` is bound to a TestComponent, where we subscribe the event.

So the event is emitted as soon as we enter the app, but it's been subscribed only when we enter the `/test` route. How can we solve this, without changing the logic?

The solution is as easy as changing a name. Instead of using the `Subject` object, we can just use the `ReplaySubject`. And the code before becomes:

```typescript
let subject: ReplaySubject<string> = new ReplaySubject(1); 
subject.next('test');
subject.subscribe((event) => { 
  console.log(event); 
});
```

Let's celebrate! Even if we are subscribing the event after it has been emitted, now we'll get our `'test'` string printed out to console!

How does `ReplaySubject` work?

It keeps in **memory** the last event emitted and will **emit it again to every new subscriber**. Actually, you can also change the constructor parameter from 1 to the number you need, in order to keep in memory more events and emit them again when you subscribe it: `new ReplaySubject(5)`.

Of course, this is working not just for the first subscriber, but for every old and new one!
