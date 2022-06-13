# Zora Marketplace Hardhat deployment + extra modules

Before you try to deploy or run tests, you need to run `initContracts` - this will initialize your `contracts` directory with contracts from the @zoralabs/v3 package

```
npm install
npx hardhat initContrainers
```

Then you can run tests 

```
npx hardhat test
```

If all looks good, you can deploy the contracts

```
npc hardhat run --network ... scripts/deploy.ts
```

This will deploy all contracts **we** need. Your mileage might vary. The command above will print a JSON object with all the deployed contracts.