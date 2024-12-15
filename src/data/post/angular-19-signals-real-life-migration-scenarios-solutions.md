---
title: "Mastering Angular 19 Signals: Real-Life Migration Scenarios and Solutions"
publishDate: 2024-12-09T00:00:00Z
excerpt: In this post, I share real-world scenarios from migrating an app to Angular 19 signals, highlighting the challenges and special cases encountered during the transition.
category: Signals
tags: 
  - observable
  - angular 19
image: "~/assets/images/angular-signals.png"
---

With **Angular 19**, I decided to transition a recent app I’ve been developing to use **signals**. The automatic [migrations](https://angular.dev/reference/migrations) made it easy to convert inputs, outputs, and template queries, but along the way, I encountered several special cases that required extra attention.

In this post, I’ll walk you through **real-world scenarios** from my app, showcasing how to handle more complex cases when migrating to signals.

## Observables that depend on inputs

So, you have run the [schematic for migrating to the new signal-based inputs](https://angular.dev/reference/migrations/signal-inputs). But what about those observables that need to wait for an input to get called? Like this one:

```typescript
@Input({required: true}) userId!: number;

ngOnInit() {
  this.userService.get(this.userId).subscribe(user => {
   this.user = user; 
  });
}
```

The solution is the new `rxResource`:

```typescript
userId = input.required<number>();
resource = rxResource({
  request: () => this.userId(),
  loader: params => this.userService.get(params.request)
});
user = computed(() => this.resource.value());
```

No need for any `OnInit` or `OnChanges` anymore! Just call `user()` anywhere in your template or in methods and other `computed` functions.

## Set the form values from an input

What if we want to set the value of a form, but have to wait for an input signal to get its value? We can refactor from this code:

```typescript
@Input({required: true}) user!: User;

ngOnInit() {
  this.form.patchValue(this.user);
}
```

to this:

```typescript
user = input.required<User>();

constructor() {
  effect(() => this.form.patchValue(this.user()));
}
```

Again, we can get rid of the `OnInit` hook, because the `effect()` function will be called as soon as `user()` gets initialized.

## Setting a default value that depends on an input

We know that signals has a default value, so we can usually write:

```typescript
selectedNumber = signal(1);
```

But what if the default value depends on an input?

Let's see this example where we want to set the default value as the first item in a list that we get from an input.

```typescript
@Input({required: true}) items: Item[];

selectedValue?: Item;

ngOnChanges() {
  this.selectedValue = this.items[0];
}
```

With signals, we can use the new `linkedSignal`:

```typescript
items = input.required<Item[]>();
selectedValue = linkedSignal(() => this.items()[0]);
```

Every time `items` changes, `selectedValue` gets updated with the new default. But since `linkedSignal` returns a `WritableSignal`, we will be able to set or update it, or bind it to a `NgModel`.

Now, what if we only want to set `selectedValue` to the first item, only the first time that `items` get initialized? If the user changes `selectedValue` manually, we may not want to initialize it again when `items` changes. This would be a similar behaviour as with the old `ngOnInit()`.

Here's the solution: using the expanded version of the `linkedSignal`:

```typescript
selectedValue = linkedSignal<Item | undefined>({
  source: () => this.items(),
  computation: (source, previous) => {
    return previous?.value || (source.length > 0 ? source[0] : undefined);
  },
});
```

The `computation` function exposes the previous value of the signal, so we can return our default only if we haven't done it yet.

## Auto focus on a viewChild element

Another schematic you might have run is the one for [migrating to the new signal queries](https://angular.dev/reference/migrations/signal-queries).

If we have a `textarea` where we want to focus when the element is ready, how do we do it now, if we want to move from the classic Lifecycle?

The old code:

```typescript
@ViewChild('myInput') myInput!: ElementRef;

ngAfterViewInit() {
  this.myInput.nativeElement.focus();
}

```

The new code:

```typescript
myInput = viewChild<ElementRef>('myInput');

constructor() {
  effect(() => {
    const myInput = this.myInput();
    if (myInput) {
      myInput.nativeElement.focus();
    }
  });
}
```

The `effect()` function will be called every time `myInput` changes, which should be only two: the first time will be undefined and the second time it will contain the reference to the element. That's when we can call it.

## Paginated and filtered data

Let's see a more complex scenario: we have a list of items with pagination, a text search, and a dropdown search filter.

We want the pagination to reset every time a filter changes as well as trigger the loading. We also want to be able to manually reload the list.

This is our old-fashioned Observable code:

```typescript
page = 1;
pageChange$ = new BehaviorSubject<number>();
reload$ = new BehaviorSubject<boolean>(false);
statusCtrl = new FormControl();
searchCtrl = new FormControl();
total?: number;
loading = true;

items$ = merge(
  this.reload$,
  this.statusCtrl.valueChanges.pipe(tap(() => this.page = 1)),
  this.paymentMethodCtrl.valueChanges.pipe(tap(() => this.page = 1)),
  this.searchCtrl.valueChanges.pipe(debounceTime(500), tap(() => this.page = 1)),
  this.pageChange$,
).pipe(
  tap(() => this.loading = true),
  switchMap(() => this.itemsService.list(
    this.page,
    this.statusCtrl.value,
    this.searchCtrl.value,
  )),
  tap(() => this.loading = false),
  tap(response => this.total = response.total),
  map(response => response.data)
);

reloadItems() {
  this.reload$.next(true);
}
```

While the HTML template would be something like:

```html
<input [formControl]="searchCtrl" />
<select [formControl]="statusCtrl">...</select>

@for (item of items$ | async) {
...
}
<app-pagination [page]="page" (pageChange)="pageChange$.next($event)" [total]="total" />
```

Here's how we can refactor the code with signals, in a more imperative way.

First of all, we want to convert the Observable into a signal. We could use `toSignal`, but it wouldn't trigger the changes when the page or filters change. The new `rxResource` comes to the rescue again!

```typescript
resource = rxResource({
  request: () => ({
    page: this.page(),
    status: this.status(),
    search: this.search()
  }),
  loader: params => timer(500).pipe(
    switchMap(() => this.itemsService.list(
      params.request.page,
      params.request.status,
      params.request.search
    ))
  )
});
```

Whenever any signal in the request changes, it will reload the Observable, passing the new values. We also added a `timer` for debouncing the search input.

We also need to create those signals:

```typescript
status = signal<string | undefined>(undefined);
search = signal<string | undefined>(undefined);
```

While `status` and `search` could just be normal signals, `page` needs to reset to 1 when `status` or `search` change. But we also need to be able to set externally, from a paginator for example. This is the perfect case for using the new `linkedSignal`:

```typescript
page = linkedSignal({
  source: () => {
    this.search();
    this.status()
  },
  computation: () => 1
});
```

We can finally create the last computed values:

```typescript
items = computed(() => this.resource.value()?.data);
loading = computed(() => this.resource.isLoading());
total = computed(() => this.resource.value()?.total);
```

And if we need the reload method, it just comes with `rxResource`:

```typescript
reloadItems() {
  this.resource.reload();
}
```

The HTML will look like this:

```html
<input [(ngModel)]="search" />
<select [(ngModel)]="status">...</select>

@for (item of items()) {
...
}
<app-pagination [(page)]="page" [total]="total()" />
```

## Paginated data with load more

Another case of data pagination is when we want to append the items of the new pages to the already loaded ones.

Let's take this example with Observables:

```typescript
page$ = new BehaviorSubject<number>(1);
items$ = this.page$.pipe(
  switchMap(page => this.itemsService.list(page)),
  scan((acc, items) => [...acc, ...items], [])
);

loadMore() {
  this.page$.next(this.page$.value + 1);
}
```

This is how it becomes with signals:

```typescript
page = signal(1);

resource = rxResource({
  request: () => this.page(),
  loader: params => this.itemsService.list(params.request)
});

items = linkedSignal({
  source: () => this.resource.value(),
  computation: (source, previous) => previous?.value ? [...previous.value, ...source] : source
});

loadMore() {
  this.page.update(page => page + 1);
}
```

Thanks to the previous value stored in the `linkedSignal`, we can keep appending the new items that we get from the resource.

I hope these real-life examples of transitioning to signals have been helpful. Switching to a completely new development approach can be challenging, but with time and practice, signals will become second nature!
