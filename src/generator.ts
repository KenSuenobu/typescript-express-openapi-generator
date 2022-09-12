/**
 * OpenAPI Generator
 */

(async () => {

    function parseSchemaForType(schema: any) {
        if (schema['type']) {
            if (schema['type'] === 'integer') {
                return { name: 'number', isClass: false };
            }

            if (schema['type'] === 'string') {
                return { name: 'string', isClass: false };
            }

            if (schema['type'] === 'boolean') {
                return { name: 'boolean', isClass: false };
            }

            if (schema['type'] === 'object') {
                return { name: 'any', isClass: false };
            }

            if (schema['type'] === 'array') {
                // Return array ...
                const returnValue = parseSchemaForType(schema['items']);

                returnValue['isArray'] = true;

                return returnValue;
            }
        }

        if (schema['$ref']) {
            return { name: schema['$ref'].substring(schema['$ref'].lastIndexOf('/') + 1), isClass: true };
        }

        return { name: 'string', isClass: false };
    }

    function showHelp() {
        console.log('TypeScript Express OpenAPI Generator');
        console.log('');
        console.log('Usage: tseo-gen [OpenAPI YAML file] <options>');
        console.log('');
        console.log('Where <options> are:');
        console.log('    -b [name]    The base name of the generator when creating collection classes');
        process.exit(0);
    }

    if (process.argv.includes('-h') || process.argv.includes('--help')) {
        showHelp();
    }

    const baseName = 'Generated';
    const yaml = require('yaml')
    const fs = require('fs');

    if (!fs.existsSync('src/api')) {
        fs.mkdirSync('src/api', { recursive: true });
    }

    if (!fs.existsSync('src/routes')) {
        fs.mkdirSync('src/routes', { recursive: true });
    }

    const spec = yaml.parse(fs.readFileSync('openapi/main.yml', 'utf8'));
    const tagFunctions = {};
    const tagDefinitions = {};

    for (const tag of spec['tags']) {
        tagDefinitions[tag.name] = tag.description;
    }

    for(const path of Object.keys(spec['paths'])) {
        const pathInfo = spec['paths'][path];

        for (const op of Object.keys(pathInfo)) {
            const opPath = spec['paths'][path][op];

            if (!opPath['tags']) {
                console.log(`Tags section is missing for path '${path}' ... skipping.`);
            }

            const tag = opPath['tags'][0];

            if (!tagFunctions[tag]) {
                tagFunctions[tag] = {};
            }

            if (!tagFunctions[tag][op]) {
                tagFunctions[tag][op] = [];
            }

            const ops = {};

            ops['operation'] = opPath['operationId'];
            ops['comment'] = opPath['description'] ?? 'No summary for this service';
            ops['parameters'] = opPath['parameters'];
            ops['requestBody'] = opPath['requestBody'];
            ops['responses'] = opPath['responses'];
            ops['path'] = path;

            tagFunctions[tag][op].push(ops);
        }
    }

    console.log('Generating API delegates ...');

    for (const tagName of Object.keys(tagFunctions)) {
        const delegateClass = `${tagName}APIDelegate`;
        let body = '';
        let header = '';
        let numOperations = 0;

        if (tagDefinitions[tagName]) {
            header += `/**\n * ${tagDefinitions[tagName].split('\n').join('\n * ')}\n`
                + ' * Note: This file has been automatically generated - do not modify this file.\n */\n\n';
        }

        body += `export class ${delegateClass} {\n`;

        for (const op of Object.keys(tagFunctions[tagName])) {
            for (const def of tagFunctions[tagName][op]) {
                const { operation, comment, path } = def;

                const parameters = [];
                const classes = new Set();

                if (def['parameters']) {
                    for (const param of def['parameters']) {
                        const { name, schema } = param;
                        const paramRequired = param['required'] ?? false;
                        const paramType = parseSchemaForType(schema);

                        parameters.push(`${name}${paramRequired ? '?' : ''}: ${paramType.name}`);

                        if (paramType.isClass) {
                            classes.add(paramType.name);
                        }
                    }
                }

                if (def['requestBody']) {
                    if (def['requestBody']['content']['application/json']['schema']) {
                        const schema = def['requestBody']['content']['application/json']['schema'];
                        const schemaType = parseSchemaForType(schema);

                        parameters.push(`payload?: ${schemaType.name}${schemaType.isArray === true ? '[]' : ''}`);

                        if (schemaType.isClass) {
                            classes.add(schemaType.name);
                        }
                    }
                }

                Array.from(classes.values()).forEach((x: string) => {
                    const className: string = x;

                    header += `import { ${className} } from '../model/${className.substring(0, 1).toLowerCase() + className.substring(1)}';\n`;
                });

                const responseCodes = [];
                let responseReturnType = 'void';

                for (const response of Object.keys(def['responses'])) {
                    const responseObject = def['responses'][response];

                    responseCodes.push(response);

                    if (responseObject['content']) {
                        responseReturnType = parseSchemaForType(responseObject['content']['application/json']['schema']);
                    }
                }

                if (responseReturnType !== 'void') {
                    if (responseReturnType['isArray'] === true) {
                        responseReturnType = `${responseReturnType['name']}[]`;
                    } else {
                        responseReturnType = responseReturnType['name'];
                    }
                }

                body += `    /*\n     * ${comment}\n     *\n     * Path: '${path}'\n     `
                    + `* Response codes: ${responseCodes.join(', ')}\n     */\n`;
                body += `    async ${operation}(request: {\n        ${parameters.join(',\n        ')}${parameters.length > 0 ? ',' : ''}\n    }): Promise<${responseReturnType}> {\n`;
                body += `        console.log(\`[${operation}] Request: \${JSON.stringify(request, null, 2)}\`);\n`;
                body += '        throw new Error(\'Method not implemented.\');\n';
                body += '    }\n\n';

                numOperations++;
            }
        }

        body += '}\n';

        console.log(`- Generating Delegate for '${delegateClass}' (${numOperations} operations) -> src/api/${delegateClass}.ts`);
        fs.writeFileSync(`src/api/${delegateClass}.ts`, header + (header !== '' ? '\n' : '') + body);
    }

    let controllerBody = `/**\n * ${baseName} Delegate Controller module for Express REST services\n *\n `
      + ' * This module is used to register the `Delegate` implementations, such that each REST service\n'
      + ' * that gets triggered through Express will call the appropriate function with the appropriate\n'
      + ' * input payload.\n */\n\n';

    for (const tagName of Object.keys(tagFunctions)) {
        controllerBody += `import { ${tagName}APIDelegate } from './${tagName}APIDelegate';\n`;
    }

    let indexBody = '/**\n * Main index file for all API delegates and controller.\n *\n * This file is automatically '
      + 'generated - do not edit this file.\n */\n\n';

    for (const tagName of Object.keys(tagFunctions)) {
        const delegateClass = `${tagName}APIDelegate`;

        indexBody += `export * from './${delegateClass}';\n`;
    }

    indexBody += `export * from './${baseName}Controller';\n`;

    console.log(`- Generating index.ts`);

    fs.writeFileSync('src/api/index.ts', indexBody);

    console.log(`- Generating ${baseName} Controller module -> src/api/${baseName}Controller.ts`);

    let accessorBody = '\n';

    controllerBody += '\n';
    controllerBody += `export class ${baseName}Controller {\n\n`;

    Object.keys(tagFunctions).forEach((tagName) => {
        const delegateName = `${tagName.toLowerCase().substring(0, 1) + tagName.substring(1)}ApiDelegateImpl`;
        const delegateAccessorName = `${tagName.toLowerCase().substring(0, 1) + tagName.substring(1)}DelegateImpl`;

        controllerBody += `    private ${delegateName} = new ${tagName}APIDelegate();\n`;
        accessorBody += `    public get ${delegateAccessorName}(): ${tagName}APIDelegate {\n`
          + `        return this.${delegateName};\n`
          + '    }\n\n';
        accessorBody += `    public set ${delegateAccessorName}(impl: ${tagName}APIDelegate) {\n`
            + `        this.${delegateName} = impl;\n`
            + '    }\n\n';
    });

    controllerBody += accessorBody + '}\n';

    fs.writeFileSync(`src/api/${baseName}Controller.ts`, controllerBody);

    console.log('\nGenerating routes ...');

    for (const tagName of Object.keys(tagFunctions)) {
        let routeBody = '';

        routeBody += `/**\n * ${tagName}Router routes all REST service requests through to the ${baseName}Controller.\n`
          + ` *\n * This file was automatically generated - do not modify this file.\n */\n`;
        routeBody += `import { Application } from 'express';\nimport { ${baseName}Controller } from '../api/${baseName}Controller';\n\n`;
        routeBody += `export class ${tagName}Router {\n`;
        routeBody += `    /**\n     * Registers REST endpoints to an \`express\` server instance.\n     *\n     * @param app `
          + 'The active `express` instance to register paths to.\n     * @param controller The '
          + `\`${baseName}Controller\` to call delegate functions when a service is requested.\n     */\n`;
        routeBody += `    static register(app: Application, controller: ${baseName}Controller) {\n`;

        const delegateAccessorName = `${tagName.toLowerCase().substring(0, 1) + tagName.substring(1)}DelegateImpl`;

        for (const op of Object.keys(tagFunctions[tagName])) {
            for (const def of tagFunctions[tagName][op]) {
                const {operation} = def;
                let {path} = def;
                const parameters: string[] = [];

                if (def['parameters']) {
                    for (const param of def['parameters']) {
                        const { name } = param;

                        parameters.push(`'${name}': req.params['${name}']`);
                    }
                }

                if (def['requestBody']) {
                    if (def['requestBody']['content']['application/json']['schema']) {
                        const schema = def['requestBody']['content']['application/json']['schema'];
                        const schemaType = parseSchemaForType(schema);

                        parameters.push(`'payload': req.params['payload']`);
                    }
                }

                let responseReturnType = 'void';

                for (const response of Object.keys(def['responses'])) {
                    const responseObject = def['responses'][response];

                    if (responseObject['content']) {
                        responseReturnType = parseSchemaForType(responseObject['content']['application/json']['schema']);
                    }
                }

                if (responseReturnType !== 'void') {
                    if (responseReturnType['isArray'] === true) {
                        responseReturnType = `${responseReturnType['name']}[]`;
                    } else {
                        responseReturnType = responseReturnType['name'];
                    }
                }

                // Replace any occurrences of "{variable}" with ":variable" for REST notation
                path = path.replace(/\{(\w+)}/, ':$1');

                routeBody += `        app.${op}('${path}', async (req, res) => {\n`;
                routeBody += '            try {\n';

                if (responseReturnType !== 'void') {
                    routeBody += `                const results = await controller.${delegateAccessorName}.${operation}({\n`;
                } else {
                    routeBody += `                await controller.${delegateAccessorName}.${operation}({\n`;
                }

                routeBody += `                    ${parameters.join(',\n                ')}${parameters.length > 0 ? ',' : ''}\n`;
                routeBody += '                });\n\n';
                routeBody += '                res.type(\'application/json\');\n';

                if (responseReturnType !== 'void') {
                    routeBody += '                res.send(JSON.stringify(results, null, 2));\n';
                } else {
                    routeBody += '                res.send(\'{}\');\n';
                }

                routeBody += '                res.end();\n';
                routeBody += '            } catch (e) {\n';
                routeBody += `                console.error('An error occurred while handling route for path: ${path}');\n`;
                routeBody += '                console.error(`Stack: ${e.stack}`);\n';
                routeBody += '                res.status(e.status ?? 500).send(`An error occurred while processing this request.<p/>\\n<pre>${e.stack}</pre>\\n`);\n';
                routeBody += '                res.end();\n';
                routeBody += '            }\n';
                routeBody += '        });\n\n';
            }
        }

        routeBody += '    }\n';
        routeBody += '}';

        console.log(`- Generating Routes for '${tagName}Router' -> src/api/${tagName}Router.ts`);

        fs.writeFileSync(`src/routes/${tagName}Router.ts`, routeBody);
    }

    console.log(`- Generating ${baseName}Router.ts`);

    indexBody = '/**\n * All router registration class.\n *\n * This file is automatically generated - do not edit this file.\n */\n\n';

    for (const tagName of Object.keys(tagFunctions)) {
        indexBody += `import { ${tagName}Router } from './${tagName}Router';\n`;
    }

    indexBody += `import { ${baseName}Controller } from '../api';\n`;
    indexBody += 'import { Application } from \'express\';\n\n';

    indexBody += `\nexport class ${baseName}Router {\n`
        + `    static registerAll(app: Application, controller: ${baseName}Controller) {\n`;

    for (const tagName of Object.keys(tagFunctions)) {
        indexBody += `        ${tagName}Router.register(app, controller);\n`;
    }

    indexBody += '    }\n}\n';

    fs.writeFileSync(`src/routes/${baseName}Router.ts`, indexBody);

    indexBody = '/**\n * Main index file for all routers.\n *\n * This file is automatically generated - do not edit this file.\n */\n\n';

    for (const tagName of Object.keys(tagFunctions)) {
        indexBody += `export * from './${tagName}Router';\n`;
    }

    console.log('- Generating index.ts');

    fs.writeFileSync('src/routes/index.ts', indexBody);

})();
