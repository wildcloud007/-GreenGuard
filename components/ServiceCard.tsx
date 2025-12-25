import React from 'react';
import { ServicePackage } from '../types';

interface ServiceCardProps {
  service: ServicePackage;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-4xl">{service.icon}</span>
          <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">
            {service.priceRange}
          </span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{service.title}</h3>
        <p className="text-gray-600 mb-4 text-sm h-10">{service.description}</p>
        
        <ul className="space-y-2">
          {service.features.map((feature, idx) => (
            <li key={idx} className="flex items-center text-sm text-gray-700">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ServiceCard;