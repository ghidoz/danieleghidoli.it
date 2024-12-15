---
title: "Combining multiple Http streams with RxJS Observables in Angular"
publishDate: 2016-10-22T00:00:00Z
category: "RxJS"
excerpt: RxJS Observables in Angular are more flexible than old Promises, though seemingly more complex, allowing us to combine and chain multiple HTTP streams to get the desired data.
tags: 
  - "http"
  - "observable"
image: "~/assets/images/http-stream.jpg"
---

RxJS Observables, compared to the old Promises in Angular 1, seem to be more complicated to understand, but they are far more flexible. Let's see how we can combine and chain them, in order to merge multiple Http streams of data and get what we need.


The first thing we need to understand is that the `HttpClient` service in Angular returns **cold Observables**. What does it mean "cold"? According to the [definition](https://github.com/Reactive-Extensions/RxJS/blob/master/doc/gettingstarted/creating.md#cold-vs-hot-observables):

> Cold observables start running upon subscription, i.e., the observable sequence only starts pushing values to the observers when Subscribe is called.

If you want to know more about cold and hot Observables, you can refer to [this awesome article from Thoughtram](http://blog.thoughtram.io/angular/2016/06/16/cold-vs-hot-observables.html). For now, what we just need to know is that we have to manipulate our stream of data before calling the `subscribe()` method on the Observable.

A best practice, indeed, is keeping all the stream manipulation logic inside our service and return the Observable, that can be subscribed by the controller.

Here is a basic example of service with an `Http` call:

```typescript
@Injectable()
export class AuthorService {

  constructor(private http: HttpClient){}

  get(id: number): Observable<any> {
    return this.http.get('/api/authors/' + id);
  }
}
```

The controller should call the service, like this:

```typescript
@Component({
  selector: 'app-author',
  templateUrl: './author.component.html'
})
export class AuthorComponent implements OnInit {

  constructor(private authorService: AuthorService) {}

  ngOnInit() {
    this.authorService.get(1).subscribe((data: any) => {
      console.log(data);
    });
  }

}

/* Will return:

{
  id: 1,
  first_name: 'Daniele',
  last_name: 'Ghidoli'
}

*/
```

Ok, now let's see something more advanced!

## Combining Observables in parallel

Since **version 5.5 of RxJs**, we need to use the `pipe` function, in order to combine Observables. It accepts as many pipeable operators as we need, separated by a comma.

Imagine that you want to get the data of an author and his books, but in order to get the books you need to call a different endpoint, such as `/authors/1/books`. You should make the two calls and combine them in one response.

In order to do that, we can use the `forkJoin` RxJS operator, which is similar to the old `$q.all()` from Angular 1 and lets you execute two or more Observables in parallel:

```typescript
getAuthorWithBooks(id: number): Observable<any> {
  return forkJoin([
    this.http.get('/api/authors/' + id),
    this.http.get('/api/authors/' + id + '/books')
  ]).pipe(
    map((data: any[]) => {
      let author: any = data[0];
      let books: any[] = data[1];
      return author.books = books;
    })
  );
}

/* Will return:

{
  id: 1,
  first_name: 'Daniele',
  last_name: 'Ghidoli'
  books: [{
    id: 10,
    title: 'Awesome book',
    author_id: 1
  },
  ...
  ]
}

*/
```

As you can see from the example, `forkJoin` returns an Array with the results of the joined Observables. We can compose them as we need, in order to return just one object.

## Combining Observables in series

What if we need, for example, to get the author info from a book? We should get the book data first and, only when we get it, we can call the authors endpoint with the author id.

In this case, we'll have to use the `switchMap` RxJS operator, which is similar to the usual `map` RxJS operator. The difference is that lets you chain two Observables, returning a new Observable:

```typescript
getBookAuthor(id: number): Observable<any> {
  return this.http.get('/api/books/' + id)
    .pipe(
        switchMap((book: any) => this.http.get('/api/authors/' + book.author_id)
    );
}

/* Will return:

{
  id: 1,
  first_name: 'Daniele',
  last_name: 'Ghidoli'
}

*/
```

In this case, what we will get is just the author's info. What if we want also the book object? As before, we have to compose our objects:

```typescript
getBookWithAuthor(id: number): Observable<any> {
  return this.http.get('/api/books/' + id).pipe(
    switchMap((book: any) => this.http.get('/api/authors/' + book.author_id).pipe(
      map((author: any) => {
        book.author = author;
        return book;
      })
    ))
  );
}

/* Will return:

{
  id: 10,
  title: 'Awesome book',
  author_id: 1
  author: {
    id: 1,
    first_name: 'Daniele',
    last_name: 'Ghidoli'
  }
}

*/
```

## Combining Observables in series and in parallel

What if now we would like to do the same (getting the book with its author), but for multiple books at once? We can combine `forkJoin` and `switchMap`:

```typescript
getBooksWithAuthor(): Observable<any[]> {
  return this.http.get('/api/books/').pipe(
    switchMap((books: any[]) => {
      if (books.length > 0) {
        return forkJoin(
          books.map((book: any) => {
            return this.http.get('/api/authors/' + book.author_id).pipe(
              map((author: any) => {
                book.author = author;
                return book;
              })
            )
          })
        );
      }
      return of([]);
    })
  )
}

/* Will return:

[{
  id: 10,
  title: 'Awesome book',
  author_id: 1
  author: {
    id: 1,
    first_name: 'Daniele',
    last_name: 'Ghidoli'
  }
},
{
  id: 11,
  title: 'Another awesome book',
  author_id: 2
  author: {
    id: 2,
    first_name: 'Jeff',
    last_name: 'Arese'
  }
}]

*/
```

It seems complicated, but it's quite easy: after getting the list of books, we use the `switchMap`, in order to merge the previous call with the result of the `forkJoin`, that is called only if we have some books, otherwise we just return an Observable containing an empty array (line 17).

Maybe you are wondering why we are using the `forkJoin` here, since there is just a call. But, if you look better, there will be as many calls as many books we get. In fact, at line 6 we are looping on the books array with the `Array.map` function, **which is not the same as the `map` RxJS Operator**!

Then, for each author's call, we combine our objects and we return the book, which is what we want. Easy!

Another example can be getting author and editor info for a single book:

```typescript
getBookWithDetails(id: number): Observable<any> {
  return this.http.get('/api/books/' + id).pipe(
    switchMap((book: any) => {
      return forkJoin(
        of(book),
        this.http.get('/api/authors/' + book.author_id),
        this.http.get('/api/editors/' + book.editor_id)
      ).pipe(
        map((data: any[]) => {
          let book = data[0];
          let author = data[1];
          let editor = data[2];
          book.author = author;
          book.editor = editor;
          return book;
        })
      );
    })
  );
}

/* Will return:

{
  id: 10,
  title: 'Awesome book',
  author_id: 1,
  editor_id: 42
  author: {
    id: 1,
    first_name: 'Daniele',
    last_name: 'Ghidoli'
  },
  editor: {
    id: 42,
    name: 'Universe Editor'
  }
}

*/
```

As we can see, the `forkJoin` return an array with the result of each Observable, that we can compose in order to return the final object. Note that we are forkJoining the `book` object itself, converting it into an Observable thanks to the `of` RxJS operator, so that we can access it in the following `map`.

## Including the operators

The last thing I would like to share with you (maybe should have been the first!): don't forget to include the RxJS operators you are using.

The general rule is as follows:

Creation methods, types, schedulers and utilities are imported from **rxjs/index**:

```typescript
import { Observable, pipe, of, forkJoin } from 'rxjs/index';
```

All pipeable operators are imported from **rxjs/internal/operators**:

```typescript
import { map, switchMap } from 'rxjs/internal/operators';
```

I hope that RxJS operator are more clear now! Enjoy!
