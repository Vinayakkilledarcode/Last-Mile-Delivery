import db from '../db.js';

export function findNearestAvailableAgent(pickupZoneId, excludeAgentId = null) {
  const sameZoneAgent = db.prepare(`
    SELECT u.* FROM users u
    WHERE u.role = 'agent' AND u.is_available = 1 AND u.current_zone_id = ?
    ${excludeAgentId ? 'AND u.id != ?' : ''}
    ORDER BY (
      SELECT COUNT(*) FROM orders o
      WHERE o.agent_id = u.id AND o.status NOT IN ('Delivered','Failed')
    ) ASC
    LIMIT 1
  `).get(...(excludeAgentId ? [pickupZoneId, excludeAgentId] : [pickupZoneId]));

  if (sameZoneAgent) return sameZoneAgent;

  const anyAgent = db.prepare(`
    SELECT u.* FROM users u
    WHERE u.role = 'agent' AND u.is_available = 1
    ${excludeAgentId ? 'AND u.id != ?' : ''}
    ORDER BY (
      SELECT COUNT(*) FROM orders o
      WHERE o.agent_id = u.id AND o.status NOT IN ('Delivered','Failed')
    ) ASC
    LIMIT 1
  `).get(...(excludeAgentId ? [excludeAgentId] : []));

  return anyAgent || null;
}
