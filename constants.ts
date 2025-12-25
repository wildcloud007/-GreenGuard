import { ServicePackage } from './types';

export const SYSTEM_INSTRUCTION = `You are a friendly, professional, and knowledgeable sales representative for "GreenGuard Landscaping". 
Your goal is to have a natural voice conversation with potential clients to:
1. Qualify their property needs (size of lawn, current state, specific issues like weeds or snow).
2. Explain our service packages (Lawn Care, Seasonal Maintenance, Snow Removal) based on their needs.
3. Schedule a free site visit/quote.

Key Service Details:
- Lawn Care: Weekly mowing, edging, fertilization.
- Seasonal Maintenance: Spring/Fall cleanup, pruning, aeration.
- Snow Removal: Plowing, salting, walkway clearing (Unlimited seasonal contracts available).

Tone: Warm, helpful, not overly pushy, but efficient. 
Keep your responses relatively concise as this is a voice conversation. Avoid long monologues.
If the user wants to book a visit, ask for their name, address, and preferred time, then use the 'book_site_visit' tool.`;

export const SERVICE_PACKAGES: ServicePackage[] = [
  {
    id: 'lawn',
    title: 'Premium Lawn Care',
    description: 'Keep your grass green and healthy all season long.',
    features: ['Weekly Mowing & Edging', 'Fertilization Program', 'Weed Control', 'Grub Prevention'],
    priceRange: '$150 - $300 / month',
    icon: '🌱'
  },
  {
    id: 'seasonal',
    title: 'Seasonal Maintenance',
    description: 'Deep cleaning and preparation for weather changes.',
    features: ['Spring Cleanup', 'Fall Leaf Removal', 'Shrub Pruning', 'Aeration & Overseeding'],
    priceRange: '$400 - $800 / visit',
    icon: '🍂'
  },
  {
    id: 'snow',
    title: 'Snow & Ice Management',
    description: 'Reliable removal when the storms hit.',
    features: ['Driveway Plowing', 'Walkway Shoveling', 'Salting/De-icing', '24/7 Monitoring'],
    priceRange: '$500 - $1200 / season',
    icon: '❄️'
  }
];