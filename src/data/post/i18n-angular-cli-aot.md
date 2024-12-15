---
title: "Angular 2 internationalization explained: i18n + Angular CLI + AOT"
publishDate: 2017-01-15T00:00:00Z
excerpt:
  Deploying an i18n Angular 2 app is challenging due to poor documentation and ongoing development, but after weeks of effort, I managed to make it work—and so can you.
category: "i18n"
tags: 
  - "angular-cli"
  - "aot"
image: "~/assets/images/i18n.jpg"
---

As of today, deploying an i18n Angular 2 app is not so easy. The documentation is poor and things are still in development. Despite that, after weeks of struggle, I managed to make things work. And so you do now.

## JIT vs AOT

The first thing you need to know is that an Angular 2 application can be compiled in two different modes: _Just-in-Time_ (JIT) or _Ahead-of-Time_ (AOT). This deeply influences how the i18n process is handled.

The **JIT** compiler is the Angular CLI default one: the app is **compiled at runtime in the browser**, it's bigger and it takes more time to load.

The problem with i18n in JIT apps is that it will **slow down even more** the bootstrap, since the app will need to download the language file, parse it and replace all the texts in the views, before showing anything to the user.

On the other hand, [AOT](https://angular.io/docs/ts/latest/cookbook/aot-compiler.html#!#aot-jit) compilation is really quick, as the compilation process in made at **building time**. This means that we will serve to the browser an already pre-build app that is immediately showed.

Since also the i18n is handled in that moment, the downside is that we will have a **separate application package for each language**. We'll see later how to manage this.

If you are interested in i18n with JIT compilation, you can just [read the official documentation](https://angular.io/docs/ts/latest/cookbook/i18n.html#!#jit), otherwise keep reading! We'll cover the **i18n with AOT** that the documentation don't.

## Upgrade Angular CLI

Ok, before everything, upgrade your application to the latest versions of [Angular](https://github.com/angular/angular) and [Angular CLI](https://github.com/angular/angular-cli): you will need at least **Angular CLI 1.0.0-beta.24**.

This tutorial has been tested with **Angular 2.4.1**.

## Make your app compatible with AOT

Now you need to be able to compile your app with AOT. It can seem easy, but this is the **trickiest part**!

Firstly, try to **build** your app with AOT:

```shell
ng build --aot
```

If everything works, you are really lucky: you can skip to the following step! Otherwise, you will have to make some changes to your app, in order to make it **statically analyzable for AOT**. Here is a [list of the common thing](https://medium.com/@isaacplmann/making-your-angular-2-library-statically-analyzable-for-aot-e1c6f3ebedd5#.pdbeoloc2) that you may need to change.

For example I had to change this:

```typescript
{ 
  provide: HttpService, 
  useFactory: (backend: XHRBackend, defaultOptions: RequestOptions) => new HttpService(backend, defaultOptions), 
  deps: [XHRBackend, RequestOptions]
}
```

into this:

```typescript
export function httpFactory(backend: XHRBackend, defaultOptions: RequestOptions) { 
  return new HttpService(backend, defaultOptions);
} 
// ... 
{ 
  provide: HttpService, 
  useFactory: httpFactory, 
  deps: [XHRBackend, RequestOptions]
}
```

I also had to change in all my components the visibility of properties used in templates, from `private` to `public`.

After changing all this, you may still get some errors like:

> ERROR in Error encountered resolving symbol values statically. Could not resolve type...

In that case, you'll probably need to **upgrade some libraries** you are using, hoping that developers have been released a fix making them **AOT compatible**. In fact, also the third party libraries need to follow [the same rules](https://medium.com/@isaacplmann/making-your-angular-2-library-statically-analyzable-for-aot-e1c6f3ebedd5#.pdbeoloc2) as above.

An easy way to check if a library is AOT compatible is **looking for files** that ends with `*.ngfactory.ts` and `*.metadata.json`. If there are, it means that the library has been compiled with the [ngc command](https://angular.io/docs/ts/latest/cookbook/aot-compiler.html) and it should be AOT ready. Otherwise you'll need to open an issue, asking them to fix it.

## Mark all the app texts

Ok, here we are: now you can actually start to **internationalize your app**. This is the easy part: just add the `i18n` attribute to **every html tag** you want to translate. For example:

```html
<h1 i18n>Hello</h1>
```

I won't spend too much on this, since [the documentation already covers it](https://angular.io/docs/ts/latest/cookbook/i18n.html#!#i18n-attribute).

There are also some [special operators](https://angular.io/docs/ts/latest/cookbook/i18n.html#!#cardinality) like `select` and `plural`, but I have to say that they are [not working for me](https://github.com/angular/angular/issues/14396).

## Extract the messages

What I really love about this i18n approach of Angular 2 is the **extracting command** that lets you extract all the i18n-marked texts into a **translation source file**, with no effort. Almost.

It can create two different translation file formats: [XLIFF](https://en.wikipedia.org/wiki/XLIFF) (default) and [XMB](http://cldr.unicode.org/development/development-process/design-proposals/xmb). I opted for the second one, as it's the most common and it should support plurals and select.

So, **add this command** to the `scripts` section in your `package.json`:

```json
"i18n": "ng-xi18n -p src/tsconfig.json --i18nFormat=xmb"
```

Before launching it, you also need to tell the compiler to **exclude the tests file** from the compilation or you'll get an [error](https://github.com/angular/angular/issues/13624). Add this line to `tsconfig.json`:

```json
"exclude": [ "test.ts" ]
```

By default, the language file will be created in the app root. You can **customize the path** by adding also this line to `tsconfig.json`:

```json
"angularCompilerOptions": { "genDir": "../src/locale" }
```

Now you can **launch** the extraction:

```shell
npm run i18n
```

If you are lucky (again!), a `messages.xmb` file should have been created. Otherwise, you may encounter **some new errors** that the AOT had not found.

For example, I had to **change the import paths of all my scss files** from this:

```css
@import "../../style/common";
```

to this:

```css
@import "../../style/_common.scss";
```

specifying the exact path. Why? Due a [bug](https://github.com/angular/angular-cli/issues/2201#issuecomment-259095785) that still need to be solved.

There can be other errors, but you can ignore them as long as the `messages.xmb` file has been created anyway.

## Let's have fun! Translate your app!

Fine. We now have an `.xmb` file, but guess what? We need an `.xtb` file in order to build our app!

A simple solution is using a **free online service** like [POEditor](https://poeditor.com/): you can upload your xmb file, translate your texts in all the needed languages and export your xtb files with a few clicks.

## Build the app

We are ready to **build** our app! Let's say we have translated all the texts in Spanish, you can launch this command:

```shell
ng build --aot --locale es --i18n-file src/locale/messages.es.xtb --i18n-format xtb
```

You should get your **internationalized package** into the `dist` folder! You can also launch the `ng serve` command with the same parameters, in order to serve the Spanish app.

Hurrah! Easy, isn't it?

## How to serve the correct language

Now we have two (or three, or ten) different applications, one per language. Fine, how can we decide **which one to serve** to our user, using Angular?

The answer is easy: **we can't**!

What? The truth is that when we serve the Angular app, we are already serving a pre-compiled package. We cannot get the browser language and the decide which app to server from within the Angular app itself as we can do with [JIT compilation](https://angular.io/docs/ts/latest/cookbook/i18n.html#!#jit).

So? What's the [solution](https://github.com/angular/angular-cli/issues/2201#issuecomment-267147576)? At the moment you can:

- Doing it server side
- Having an initial page that redirect the user to the right application
- Having a landing when the user can decide which language he prefers

What it's sure is that you have to deploy each application into a **different directory**. Eg: /en, /es...

## How to detect the language from within the app

Sometimes you need to know from the app itself **which is the current language** being served. For example in order to display a language selector or for **localizing third party libraries**, such as MomentJs.

Of course, you could parse the URL, but it's not really a best practice.

Angular comes in our help with a `LOCALE_ID` opaque token that can be injected and it gets the same value that you pass to the `ng serve` command with the `--locale` parameter. You can use it like this:

```typescript
import { LOCALE_ID } from '@angular/core'; 
// ... 
constructor (@Inject(LOCALE_ID) locale: string) { 
  moment.locale(locale);
}
```

## Conclusions

I think the Angular team has done a **good job** with i18n, even though it's not so easy to implement, as you saw.

By the way, it still has **many problems** and undefined procedures. The problem about serving the right language or with the scss parser, for example. Or how can you translate a [string that does not appear in a template](https://github.com/angular/angular/issues/11405), but just in code?

Everything is still in development and it changes everyday! In order to stay up to date, I suggest you to follow [these](https://github.com/angular/angular-cli/issues/2201) [issues](https://github.com/angular/angular/issues/9104#issuecomment-266453448) on GitHub.

And if this post has been useful, please **share it**!
