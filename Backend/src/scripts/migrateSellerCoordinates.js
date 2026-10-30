import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const sellerCoordinatesMap = [
  { match: /jasnath/i, lng: 71.8500, lat: 25.8850, city: 'Manpura Kharda', state: 'Rajasthan', radius: 15 },
  { match: /ram dev/i, lng: 71.3967, lat: 25.7532, city: 'Barmer', state: 'Rajasthan', radius: 10 },
  { match: /fashion hub/i, lng: 75.8937, lat: 22.7533, city: 'Indore', state: 'Madhya Pradesh', radius: 10 },
  { match: /fashion gallary/i, lng: 75.8790, lat: 22.7180, city: 'Indore', state: 'Madhya Pradesh', radius: 8 },
  { match: /clothing hub/i, lng: 75.8648, lat: 22.7196, city: 'Indore', state: 'Madhya Pradesh', radius: 8 },
  { match: /green mart/i, lng: 72.8777, lat: 19.0760, city: 'Mumbai', state: 'Maharashtra', radius: 15 },
  { match: /indore/i, lng: 75.8577, lat: 22.7196, city: 'Indore', state: 'Madhya Pradesh', radius: 10 },
  { match: /rajasthan|barmer/i, lng: 71.3967, lat: 25.7532, city: 'Barmer', state: 'Rajasthan', radius: 10 },
];

async function migrateSellersAndProducts() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Sathi Seller';
  console.log('Connecting to MongoDB:', uri);
  await mongoose.connect(uri);

  const Seller = mongoose.model('Seller', new mongoose.Schema({}, { strict: false }));
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

  const sellers = await Seller.find();
  console.log(`Found ${sellers.length} sellers in database`);

  for (const seller of sellers) {
    const name = seller.businessName || '';
    const address = seller.warehouseLocation?.storeAddress || '';
    const city = seller.warehouseLocation?.city || seller.city || '';
    const state = seller.warehouseLocation?.state || seller.state || '';
    const fullSearch = `${name} ${address} ${city} ${state}`;

    let matchedGeo = null;
    for (const rule of sellerCoordinatesMap) {
      if (rule.match.test(fullSearch)) {
        matchedGeo = rule;
        break;
      }
    }

    if (!matchedGeo) {
      // Default to Indore if no other match
      matchedGeo = { lng: 75.8577, lat: 22.7196, radius: 10 };
    }

    const currentCoords = seller.location?.coordinates || seller.warehouseLocation?.location?.coordinates || [0, 0];
    const needsUpdate = currentCoords[0] === 0 && currentCoords[1] === 0;

    const newRadius = Number(seller.serviceRadius) > 0 && Number(seller.serviceRadius) <= 200 
      ? Number(seller.serviceRadius) 
      : matchedGeo.radius;

    const updateDoc = {
      $set: {
        serviceRadius: newRadius,
        'location.type': 'Point',
        'location.coordinates': needsUpdate ? [matchedGeo.lng, matchedGeo.lat] : currentCoords,
        'warehouseLocation.location.type': 'Point',
        'warehouseLocation.location.coordinates': needsUpdate ? [matchedGeo.lng, matchedGeo.lat] : currentCoords,
        status: seller.status || 'approved',
        accountStatus: seller.accountStatus || 'approved',
      }
    };

    await Seller.updateOne({ _id: seller._id }, updateDoc);
    console.log(`Updated seller: [${seller.businessName}] -> Coords: [${needsUpdate ? matchedGeo.lng : currentCoords[0]}, ${needsUpdate ? matchedGeo.lat : currentCoords[1]}], Radius: ${newRadius} KM`);
  }

  // Next, link products to their respective sellerId if missing
  const products = await Product.find();
  console.log(`\nFound ${products.length} products in database`);

  for (const product of products) {
    if (!product.sellerId && product.seller) {
      // Find matching seller by businessName
      const matchingSeller = await Seller.findOne({
        businessName: { $regex: new RegExp(`^${product.seller.trim()}$`, 'i') }
      });

      if (matchingSeller) {
        await Product.updateOne(
          { _id: product._id },
          { $set: { sellerId: matchingSeller._id, seller: matchingSeller.businessName } }
        );
        console.log(`Linked product [${product.name}] to seller [${matchingSeller.businessName}] (${matchingSeller._id})`);
      } else {
        // If seller name is 'Sathi Seller Official Store' or legacy, link to official Indore store or first approved seller
        const defaultSeller = await Seller.findOne({ status: 'approved' });
        if (defaultSeller) {
          await Product.updateOne(
            { _id: product._id },
            { $set: { sellerId: defaultSeller._id, seller: defaultSeller.businessName } }
          );
          console.log(`Linked legacy product [${product.name}] to default seller [${defaultSeller.businessName}] (${defaultSeller._id})`);
        }
      }
    }
  }

  console.log('\nMigration and Geocoding Completed Successfully.');
  await mongoose.disconnect();
}

migrateSellersAndProducts().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
