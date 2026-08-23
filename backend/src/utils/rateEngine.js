import db from '../db.js';

export function findAreaByName(name) {
  const normalized = name.trim().toLowerCase();
  return db.prepare('SELECT * FROM areas WHERE LOWER(name) = ?').get(normalized);
}

export function calculateVolumetricWeight(length, breadth, height) {
  return (length * breadth * height) / 5000;
}

export function calculateCharge({ pickupAreaName, dropAreaName, length, breadth, height, actualWeight, orderType, paymentType }) {
  const pickupArea = findAreaByName(pickupAreaName);
  const dropArea = findAreaByName(dropAreaName);

  if (!pickupArea) throw new Error(`Pickup area "${pickupAreaName}" is not mapped to any zone. Ask admin to add it.`);
  if (!dropArea) throw new Error(`Drop area "${dropAreaName}" is not mapped to any zone. Ask admin to add it.`);

  const zoneRelation = pickupArea.zone_id === dropArea.zone_id ? 'intra' : 'inter';

  const volumetricWeight = calculateVolumetricWeight(length, breadth, height);
  const billedWeight = Math.max(actualWeight, volumetricWeight);

  const rateCard = db.prepare(
    'SELECT * FROM rate_cards WHERE order_type = ? AND zone_type = ?'
  ).get(orderType, zoneRelation);

  if (!rateCard) {
    throw new Error(`No rate card configured for ${orderType} / ${zoneRelation}-zone. Ask admin to set one up.`);
  }

  const baseCharge = rateCard.base_price + billedWeight * rateCard.rate_per_kg;

  let codSurcharge = 0;
  if (paymentType === 'COD') {
    const surchargeRow = db.prepare('SELECT * FROM cod_surcharges WHERE order_type = ?').get(orderType);
    codSurcharge = surchargeRow ? surchargeRow.surcharge_amount : 0;
  }

  const totalCharge = Math.round((baseCharge + codSurcharge) * 100) / 100;

  return {
    pickupArea,
    dropArea,
    zoneRelation,
    volumetricWeight: Math.round(volumetricWeight * 1000) / 1000,
    billedWeight: Math.round(billedWeight * 1000) / 1000,
    baseCharge: Math.round(baseCharge * 100) / 100,
    codSurcharge,
    totalCharge,
  };
}
