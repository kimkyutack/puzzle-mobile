import type {Product} from '@garden/contracts';

export type PurchaseGrant = Pick<Product,'coins'|'items'|'unlimitedSeconds'>;

// Intents created before 0017 and their later refunds use the rewards quoted at the time.
const legacyBundles: Readonly<Record<string,PurchaseGrant>> = {
 'garden.starter':{coins:1500,items:{hammer:3,'wind-row':3,bomb:3},unlimitedSeconds:1800},
 'garden.boosters':{coins:2000,items:{hammer:5,'sweep-row':3,'sweep-column':3,shuffle:5,bomb:3,rainbow:3},unlimitedSeconds:3600},
 'garden.offer.timed':{coins:1000,items:{hammer:2,'wind-row':2,bomb:2},unlimitedSeconds:1800},
 'garden.offer.limited':{coins:1800,items:{hammer:3,'sweep-row':2,'sweep-column':2,bomb:2,rainbow:1},unlimitedSeconds:1800},
 'garden.offer.chain.1':{coins:700,items:{hammer:1,'wind-row':1,bomb:1},unlimitedSeconds:900},
 'garden.offer.chain.2':{coins:2500,items:{hammer:3,'sweep-row':2,'sweep-column':2,bomb:2},unlimitedSeconds:1800},
 'garden.offer.chain.3':{coins:5000,items:{hammer:5,'sweep-row':3,'sweep-column':3,rainbow:3,bomb:3},unlimitedSeconds:3600},
 'garden.offer.chain.4':{coins:11000,items:{hammer:10,'sweep-row':5,'sweep-column':5,'wind-row':5,bomb:5,rainbow:5},unlimitedSeconds:7200},
};

export function snapshotPurchaseGrant({coins,items,unlimitedSeconds}:PurchaseGrant){
 return JSON.stringify({coins,items,unlimitedSeconds});
}

export function purchaseGrantForIntent(product:Product,snapshot:string|null):PurchaseGrant{
 return snapshot ? JSON.parse(snapshot) as PurchaseGrant : legacyBundles[product.id]??product;
}
