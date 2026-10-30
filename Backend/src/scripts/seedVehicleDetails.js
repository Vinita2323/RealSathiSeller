import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import mongoose from 'mongoose';
import VehicleType from '../models/VehicleType.model.js';

async function seedVehicleDetails() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected for vehicle details seeding');

  const defaultVehicles = [
    {
      name: 'Bike / Two Wheeler',
      slug: 'motorcycle',
      vehicleCategory: '2_wheeler',
      capacityKg: 20,
      dimensions: '40 x 40 x 40 cm',
      suitableFor: 'Small packages, Documents, Food items, Medicines, Groceries',
      description: 'Quick city courier for small parcels and urgent documents up to 20 kg.',
      baseFare: 30,
      perKmFare: 10,
      minimumFare: 50,
      platformFee: 5,
      speedKmH: 35,
      icon: 'bike',
      sortOrder: 1,
      isActive: true,
    },
    {
      name: '3 Wheeler / Auto Cargo',
      slug: 'three-wheeler',
      vehicleCategory: '3_wheeler',
      capacityKg: 500,
      dimensions: '5.5 x 4.0 x 4.0 ft',
      suitableFor: 'Medium boxes, Electronic appliances, Commercial crates, Grocery sacks',
      description: 'Auto-rickshaw cargo variant. Great for medium goods up to 500 kg.',
      baseFare: 60,
      perKmFare: 14,
      minimumFare: 120,
      platformFee: 15,
      speedKmH: 25,
      icon: 'auto',
      sortOrder: 2,
      isActive: true,
    },
    {
      name: 'Tata Ace / Mini Truck',
      slug: 'mini-truck',
      vehicleCategory: '4_wheeler',
      capacityKg: 750,
      dimensions: '7.0 x 4.5 x 5.0 ft',
      suitableFor: 'Household shifting, Large furniture, Industrial goods, Heavy cartons',
      description: 'Compact 4-wheeler truck for household and commercial goods up to 750 kg.',
      baseFare: 80,
      perKmFare: 18,
      minimumFare: 200,
      platformFee: 20,
      speedKmH: 30,
      icon: 'truck',
      sortOrder: 3,
      isActive: true,
    },
    {
      name: 'Pickup 8ft / Bolero Maxi',
      slug: 'pickup-8ft',
      vehicleCategory: '4_wheeler',
      capacityKg: 1200,
      dimensions: '8.0 x 4.8 x 5.5 ft',
      suitableFor: 'Machinery, Commercial pallet goods, Wholesale bulk crates, Plywood',
      description: '8-foot flatbed pickup truck. Suitable for furniture and large goods up to 1200 kg.',
      baseFare: 120,
      perKmFare: 24,
      minimumFare: 350,
      platformFee: 25,
      speedKmH: 35,
      icon: 'pickup',
      sortOrder: 4,
      isActive: true,
    },
    {
      name: 'Truck 14ft / Heavy Duty',
      slug: 'truck-14ft',
      vehicleCategory: 'heavy_truck',
      capacityKg: 2500,
      dimensions: '14.0 x 6.0 x 6.5 ft',
      suitableFor: 'Heavy freight, Large scale logistics, Industrial cargo, Full house relocation',
      description: '14-foot truck for heavy commercial shipments and intercity freight up to 2500 kg.',
      baseFare: 200,
      perKmFare: 35,
      minimumFare: 600,
      platformFee: 30,
      speedKmH: 40,
      icon: 'truck',
      sortOrder: 5,
      isActive: true,
    },
  ];

  for (const v of defaultVehicles) {
    await VehicleType.findOneAndUpdate(
      { slug: v.slug },
      { $set: v },
      { upsert: true, new: true }
    );
    console.log(`✓ Seeded/Updated vehicle: ${v.name} (${v.slug})`);
  }

  console.log('\nAll vehicle details seeded successfully!');
  await mongoose.disconnect();
}

seedVehicleDetails().catch(err => {
  console.error(err);
  process.exit(1);
});
