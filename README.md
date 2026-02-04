# ![icon](src/images/icon.png) Autocoder - Azure DevOps pipeline task that uses AI coding agents to automatically generate code from work items and create pull requests.

For documentation and more details, see the [Marketplace entry](https://marketplace.visualstudio.com/items?itemName=RaduGheorghiu.autocoder-task).

## Building

```bash
cd src/AutoCoderV1
npm install
npm run build
npm run package:dev   # For dev version
npm run package:release  # For release version
npm run publish:dev   # To publish dev version
npm run publish:release  # To publish release version
```

## Future Plans
- Support for more AI models and providers (local models as well).
- Support for choosing the AI model.
- Ability for the agents to respond to code review comments.
- Ability for the agents to post the pull requests directly to Azure DevOps with their own description.
- Ability to run the pipeline directly from the work item.

Feel free to contribute!
