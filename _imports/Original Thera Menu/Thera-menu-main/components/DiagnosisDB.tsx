
import React from 'react';
import { DiagnosisType } from '../types';
import { CLINICAL_PROTOCOLS } from '../constants';

const DiagnosisDB: React.FC = () => {
  const diagnoses = Object.values(DiagnosisType).filter(v => v !== DiagnosisType.CUSTOM);

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Clinical Protocols Database</h2>
        <p className="text-gray-600 font-medium mt-2 text-sm">Core logic rules used by TheraMenu Intelligence to audit and transform patient meals.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {diagnoses.map((diag) => (
          <div key={diag} className="bg-white rounded border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded border border-blue-100">Protocol Active</span>
              <i className="fas fa-file-medical text-gray-300 group-hover:text-blue-200 transition-colors text-lg"></i>
            </div>
            <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide mb-2">{diag}</h3>
            <p className="text-sm text-gray-600 leading-relaxed min-h-[60px]">
              {CLINICAL_PROTOCOLS[diag] || "Standard clinical nutritional therapy protocol with focused nutrient management for training purposes."}
            </p>
            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-600">Na</div>
                <div className="w-6 h-6 rounded-full bg-blue-50 border-2 border-white flex items-center justify-center text-[9px] font-bold text-blue-700">K</div>
                <div className="w-6 h-6 rounded-full bg-green-50 border-2 border-white flex items-center justify-center text-[9px] font-bold text-green-700">Fe</div>
              </div>
              <button className="text-[10px] font-bold uppercase text-blue-700 hover:text-blue-900 tracking-wider">
                View Specs <i className="fas fa-chevron-right ml-1"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiagnosisDB;
