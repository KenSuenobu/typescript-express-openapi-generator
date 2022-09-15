import {ExampleController, ExamplesAPIDelegate} from "../src/api";
import {ExampleRouter} from "../src/routes/ExampleRouter";

(() => {
    class HelloWorld implements ExamplesAPIDelegate {
        async generateHelloWorld(request: {}): Promise<void> {
            console.log('Hello World called');
            return Promise.resolve();
        }
    }

    const express = require('express');
    const app = express();
    const bodyParser = require('body-parser');

    app.use(bodyParser.json());

    const port = 3000;
    const controller: ExampleController = new ExampleController();

    controller.examplesDelegateImpl = new HelloWorld();
    ExampleRouter.registerAll(app, controller);

    app.listen(port, () => {
        console.log(`Accepting connections on: http://localhost:${port}/`);
    });
})();
