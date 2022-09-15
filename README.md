# typescript-express-openapi-generator

This is a TypeScript (node.js) OpenAPI generator for REST services using Express.

## TL;DR

```
npm start
```

Connect your browser to http://localhost:3000/example/hello and see the result.

Look through `src/api` and `src/routes` directories to get a feel for what's
automatically generated.

## How to install

This project requires `ts-node` to be installed.

You should install `openapi-generator` so that model files can be generated.

## How to use

To generate model and API files from your OpenAPI script, you need to determine a
base name for the classes that are generated.  The "base name" is the name of the
overall project, like "MyProject" or "Testing".  The generated files in both the
`api` and `route` directories will be provided as convenience classes to register
all routers and all API delegates.

When using the command `tseo-gen` without any arguments, a list of help will be
generated.

By default, API and Routes will be generated in the `src/api` and `src/routes`
directories, respectively.  The first argument should be the name of the OpenAPI spec
YAML file you have created.

For instance, if `Example` were the base name, `ExampleController.ts` would be
generated in `src/api`, and `ExampleRouter.ts` would be generated in `src/routes`.

## How to implement in `express`

To set up a server wiring in express, the following is an example snipet of source
code that will do that, given the basename of `Example` above:

```javascript
import {ExampleController} from "../src/api";
import {ExampleRouter} from "../src/routes/ExampleRouter";

(() => {
    const express = require('express');
    const app = express();
    const bodyParser = require('body-parser');

    app.use(bodyParser.json());

    const port = 3000;
    const controller: ExampleController = new ExampleController();

    ExampleRouter.registerAll(app, controller);

    app.listen(port, () => {
        console.log(`Accepting connections on: http://localhost:${port}/`);
    });
})();
```

This will generate code that will implement a new Express server with the example
`ExampleController` implementing all of the delegates for each service provided by
`ExampleRouter`.

Each `Delegate` class in the `ExampleController` can be overridden using your own
implementation of the provided classes.  You must implement and override the
implementations of each delegate, otherwise, your code will be rendered useless, as
each class will simply throw an exception when called.

## See also

`bin/server.ts` ... this implements an example of the service using `example/hello`
as a URL that can be called.  It is an asynchronous function that is implemented by
the delegate, and can be (a)synchronous as required.

Any model files referenced by the openapi/main.yml spec should be generated using
the `typescript-node` generator provided by `openapi-generator`.  These API spec
files are used by the delegates when a DTO object is defined.
