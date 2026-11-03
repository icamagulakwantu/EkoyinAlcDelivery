const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPhotoPlan, parseBrandPhotoMap } = require('../prisma/catalogue-photo-matching');
const { FORMAT_PHOTO_MAP, UNPRICED_PRODUCTS } = require('../prisma/catalogue-photo-config');

test('uses exact product and pack mapping when supplied', () => {
  const rows = [{id:'1',name:'Example',bottleFormat:'750ml Bottle'},{id:'2',name:'Example',bottleFormat:'Can (500ml)'}];
  const exact = { [JSON.stringify(['Example','Can (500ml)'])]: '/images/example-can.png' };
  const plan = buildPhotoPlan(rows,{Example:'/images/example-bottle.png'},exact,()=>true);
  assert.equal(plan.assignments.find(x=>x.id==='2').imageUrl,'/images/example-can.png');
  assert.equal(plan.assignments.find(x=>x.id==='2').matchType,'format');
  assert.equal(plan.assignments.find(x=>x.id==='1').imageUrl,'/images/example-bottle.png');
});

test('uses the brand photo as fallback for other pack formats, like iCamagu', () => {
  const rows=[
    {id:'1',name:'Example',bottleFormat:'750ml Bottle'},
    {id:'2',name:'Example',bottleFormat:'Can (500ml)'},
    {id:'3',name:'Example',bottleFormat:'Dumpy (330ml)'}
  ];
  const plan=buildPhotoPlan(rows,{Example:'/images/example.png'},{},()=>true);
  assert.equal(plan.assignments.length,3);
  assert.ok(plan.assignments.every(x=>x.imageUrl==='/images/example.png' && x.matchType==='brand'));
});

test('does not assign an image when neither exact nor brand photo exists', () => {
  const rows=[{id:'1',name:'Unknown',bottleFormat:'750ml Bottle'}];
  const plan=buildPhotoPlan(rows,{},{},()=>true);
  assert.deepEqual(plan.assignments,[]);
  assert.equal(plan.unmatched.length,1);
});

test('exact pack mapping takes priority over brand fallback', () => {
  const rows=[{id:'1',name:'Example',bottleFormat:'Can (500ml)'}];
  const exact={ [JSON.stringify(['Example','Can (500ml)']) ]:'/images/can.png' };
  const plan=buildPhotoPlan(rows,{Example:'/images/bottle.png'},exact,()=>true);
  assert.equal(plan.assignments[0].imageUrl,'/images/can.png');
});

test('falls back to the brand photo when an exact-format file is missing', () => {
  const rows=[{id:'1',name:'Example',bottleFormat:'Can (500ml)'}];
  const exact={ [JSON.stringify(['Example','Can (500ml)']) ]:'/images/missing-can.png' };
  const plan=buildPhotoPlan(rows,{Example:'/images/bottle.png'},exact,path=>path==='/images/bottle.png');
  assert.equal(plan.assignments.length,1);
  assert.equal(plan.assignments[0].imageUrl,'/images/bottle.png');
  assert.equal(plan.assignments[0].matchType,'brand');
  assert.equal(plan.missingAssets.length,1);
});

test('reports a missing local brand asset instead of assigning a broken path', () => {
  const rows=[{id:'1',name:'Example',bottleFormat:'750ml Bottle'}];
  const plan=buildPhotoPlan(rows,{Example:'/images/missing.png'},{},()=>false);
  assert.equal(plan.assignments.length,0);
  assert.equal(plan.missingAssets.length,1);
  assert.equal(plan.unmatched.length,1);
});

test('parses escaped apostrophes in the existing brand photo map', () => {
  const source = "const BRAND_PHOTO_MAP = {\n  'Hunter\\'s Dry': '/images/brands/hunters-dry.png',\n  'Hennessy VS': '/images/brands/hennessy-vs.png',\n};";
  assert.deepEqual(parseBrandPhotoMap(source), {
    "Hunter's Dry": '/images/brands/hunters-dry.png',
    'Hennessy VS': '/images/brands/hennessy-vs.png',
  });
});


test('every brand-level photo mapping points to an existing local asset', () => {
  const seed = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'seed.js'), 'utf8');
  const map = parseBrandPhotoMap(seed);
  assert.ok(Object.keys(map).length > 0);
  for (const [name, imagePath] of Object.entries(map)) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', imagePath)), `${name}: missing ${imagePath}`);
  }
});

test('every exact pack-format photo mapping points to an existing local asset', () => {
  for (const [skuKey, imagePath] of Object.entries(FORMAT_PHOTO_MAP)) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', imagePath)), `${skuKey}: missing ${imagePath}`);
  }
});


test('the intentional Budweiser price-coming-soon SKU has a verified local can image', () => {
  const product = UNPRICED_PRODUCTS.find(item => item.name === 'Budweiser' && item.bottleFormat === 'Can (500ml)');
  assert.ok(product);
  assert.equal(product.listPriceZAR, undefined);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', product.imageUrl)));
});
