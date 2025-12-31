

import React from 'react';

interface FunctionCardProps {
  iconClassName: string;
  name: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
}

const FunctionCard: React.FC<FunctionCardProps> = ({ iconClassName, name, description, isActive, onClick }) => {
  const cardClasses = `function-card group relative flex flex-col items-center justify-center p-4 cursor-pointer neo-card ${isActive ? 'neo-card-active' : ''}`;
  
  return (
    <div
      className={cardClasses}
      onClick={onClick}
    >
      <div className="absolute top-1 right-1 w-5 h-5 bg-gray-800 bg-opacity-50 rounded-full flex items-center justify-center text-xs text-white opacity-70 group-hover:opacity-100 cursor-help">
        ?
      </div>
      
      <i className={`${iconClassName} neo-icon text-3xl text-gray-300 group-hover:text-purple-400 transition-all duration-200`}></i>
      <div className="mt-2 text-sm text-center font-semibold">{name}</div>

      {/* Tooltip */}
      <div
        className="absolute bottom-full mb-2 w-max max-w-[220px] p-2 bg-gray-900 text-white text-xs text-left rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 left-1/2 -translate-x-1/2"
        role="tooltip"
      >
        {description}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
      </div>
    </div>
  );
};

export default FunctionCard;