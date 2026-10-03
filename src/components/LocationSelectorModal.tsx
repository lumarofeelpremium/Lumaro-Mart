import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, X, Check, Search, Globe, Building2, Sparkles, Navigation, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { DeliveryLocation, User } from '../types';
import { 
  INDIAN_STATES, 
  POPULAR_INDIAN_STATES, 
  getDistrictsForState,
  getStateFromPincode, 
  setStoredDeliveryLocation 
} from '../lib/location-utils';
import { useModalBackHandler } from '../lib/back-button-handler';

interface LocationSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: DeliveryLocation | null;
  onSelectLocation: (loc: DeliveryLocation | null) => void;
  user?: User | null;
}

export const LocationSelectorModal: React.FC<LocationSelectorModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
  user
}) => {
  const [activeTab, setActiveTab] = useState<'pincode' | 'state'>('pincode');
  const [pincodeInput, setPincodeInput] = useState(currentLocation?.pincode || '');
  const [pincodeDistrict, setPincodeDistrict] = useState(currentLocation?.district || '');
  const [detectedState, setDetectedState] = useState<string | null>(null);
  
  // State & District selection
  const [stateStep, setStateStep] = useState<'state-list' | 'district-list'>('state-list');
  const [selectedState, setSelectedState] = useState<string>(currentLocation?.state || '');
  const [selectedDistrict, setSelectedDistrict] = useState<string>(currentLocation?.district || '');
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');

  // Mobile Hardware / Gesture Back Button Sync
  useModalBackHandler(isOpen, () => {
    if (activeTab === 'state' && stateStep === 'district-list') {
      setStateStep('state-list');
    } else {
      onClose();
    }
  }, 'location_modal');

  useEffect(() => {
    if (isOpen) {
      setPincodeInput(currentLocation?.pincode || '');
      setPincodeDistrict(currentLocation?.district || '');
      setSelectedState(currentLocation?.state || '');
      setSelectedDistrict(currentLocation?.district || '');
      setStateSearch('');
      setDistrictSearch('');

      if (currentLocation?.pincode) {
        setDetectedState(getStateFromPincode(currentLocation.pincode));
      } else {
        setDetectedState(null);
      }

      if (currentLocation?.state) {
        setStateStep('district-list');
      } else {
        setStateStep('state-list');
      }
    }
  }, [isOpen, currentLocation]);

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPincodeInput(val);
    if (val.length >= 2) {
      const state = getStateFromPincode(val);
      setDetectedState(state);
    } else {
      setDetectedState(null);
    }
  };

  const handleApplyPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincodeInput.length !== 6) {
      alert('Kripya 6-digit ka valid pincode enter karein.');
      return;
    }

    const state = detectedState || getStateFromPincode(pincodeInput) || undefined;
    const district = pincodeDistrict.trim() || undefined;
    
    let label = `Pincode ${pincodeInput}`;
    if (district && state) {
      label = `${district}, ${state} - ${pincodeInput}`;
    } else if (state) {
      label = `${state} - ${pincodeInput}`;
    }

    const newLocation: DeliveryLocation = {
      pincode: pincodeInput,
      state: state,
      district: district,
      label: label
    };

    setStoredDeliveryLocation(newLocation);
    onSelectLocation(newLocation);
    onClose();
  };

  const handleSelectEntireState = (stateName: string) => {
    setSelectedState(stateName);
    setSelectedDistrict('');
    const newLocation: DeliveryLocation = {
      state: stateName,
      label: stateName
    };

    setStoredDeliveryLocation(newLocation);
    onSelectLocation(newLocation);
    onClose();
  };

  const handleSelectDistrict = (stateName: string, districtName: string) => {
    setSelectedState(stateName);
    setSelectedDistrict(districtName);
    const newLocation: DeliveryLocation = {
      state: stateName,
      district: districtName,
      label: `${districtName}, ${stateName}`
    };

    setStoredDeliveryLocation(newLocation);
    onSelectLocation(newLocation);
    onClose();
  };

  const handleClearLocation = () => {
    setStoredDeliveryLocation(null);
    onSelectLocation(null);
    onClose();
  };

  const handleUseSavedAddress = () => {
    if (user?.pincode) {
      const state = getStateFromPincode(user.pincode) || undefined;
      const newLocation: DeliveryLocation = {
        pincode: user.pincode,
        state: state,
        label: state ? `${state} - ${user.pincode}` : `Pincode ${user.pincode}`
      };
      setStoredDeliveryLocation(newLocation);
      onSelectLocation(newLocation);
      onClose();
    }
  };

  const filteredStates = useMemo(() => {
    return INDIAN_STATES.filter(s => 
      s.toLowerCase().includes(stateSearch.toLowerCase())
    );
  }, [stateSearch]);

  const currentDistricts = useMemo(() => {
    if (!selectedState) return [];
    return getDistrictsForState(selectedState);
  }, [selectedState]);

  const filteredDistricts = useMemo(() => {
    if (!districtSearch) return currentDistricts;
    return currentDistricts.filter(d => 
      d.toLowerCase().includes(districtSearch.toLowerCase())
    );
  }, [currentDistricts, districtSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <motion.div 
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white w-full max-w-lg rounded-t-[36px] sm:rounded-[36px] p-6 max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 text-[#1A1A1A]">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <MapPin size={22} className="text-[#66D2A4]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Delivery Location</h2>
              <p className="text-xs text-gray-500">State, District ya Pincode se delivery check karein</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Active Status & Reset to All-India */}
        <div className="mt-4 p-3 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Globe size={18} className="text-emerald-600 shrink-0" />
            <div className="truncate">
              <p className="text-[11px] font-bold text-gray-700">
                {currentLocation?.label ? `Selected: ${currentLocation.label}` : 'All India (All Products Visible)'}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {currentLocation ? 'Showing products deliverable in your selected area' : 'Showing all products without location restriction'}
              </p>
            </div>
          </div>
          {currentLocation && (
            <button
              onClick={handleClearLocation}
              className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-white px-3 py-1.5 rounded-xl border border-emerald-100 shadow-2xs whitespace-nowrap"
            >
              Show All
            </button>
          )}
        </div>

        {/* User saved pincode shortcut */}
        {user?.pincode && (
          <button
            onClick={handleUseSavedAddress}
            className="mt-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100/80 hover:bg-emerald-100/50 flex items-center justify-between text-left transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <Navigation size={16} className="text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-emerald-950">Use Saved Profile Pincode: {user.pincode}</p>
                <p className="text-[10px] text-emerald-700">{user.address || 'From your profile details'}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 group-hover:underline">Apply</span>
          </button>
        )}

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-gray-100/80 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('pincode')}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'pincode' 
                ? 'bg-white text-gray-900 shadow-xs' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            📮 Enter Pincode
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('state')}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'state' 
                ? 'bg-white text-gray-900 shadow-xs' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            🏛️ State & District
          </button>
        </div>

        {/* Tab 1: Pincode Input */}
        {activeTab === 'pincode' && (
          <form onSubmit={handleApplyPincode} className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-1.5 ml-1">
                Enter 6-Digit Delivery Pincode
              </label>
              <div className="relative">
                <input 
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pincodeInput}
                  onChange={handlePincodeChange}
                  placeholder="e.g. 110001, 201301, 560001"
                  className="w-full bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 rounded-2xl py-3.5 pl-4 pr-12 text-lg font-bold text-gray-900 tracking-wider outline-none transition-all"
                  maxLength={6}
                  autoFocus
                />
                {pincodeInput.length === 6 && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                    <Check size={16} strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Detected State Banner & Optional District */}
              {detectedState ? (
                <div className="mt-2.5 space-y-2">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-2 text-xs font-bold animate-in fade-in">
                    <Sparkles size={14} className="text-emerald-600 shrink-0" />
                    <span>Detected State: <strong>{detectedState}</strong></span>
                  </div>

                  {/* Optional District selector if state detected */}
                  {getDistrictsForState(detectedState).length > 0 && (
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                        Select District (Optional):
                      </label>
                      <select
                        value={pincodeDistrict}
                        onChange={(e) => setPincodeDistrict(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs font-medium text-gray-800 outline-none focus:border-emerald-500"
                      >
                        <option value="">-- All / Not Specified --</option>
                        {getDistrictsForState(detectedState).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : pincodeInput.length >= 2 ? (
                <p className="mt-2 text-[11px] text-gray-500 ml-1">
                  Pincode match checking in progress...
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClearLocation}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition-colors"
              >
                All India (Clear)
              </button>
              <button
                type="submit"
                disabled={pincodeInput.length !== 6}
                className="flex-1 py-3.5 rounded-2xl bg-[#66D2A4] hover:bg-[#57bd91] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-[#66D2A4]/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Check size={16} /> Apply Pincode
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: State & District Selector */}
        {activeTab === 'state' && (
          <div className="mt-4 space-y-4">
            {stateStep === 'state-list' ? (
              // Step A: Pick State
              <div className="space-y-3.5">
                {/* Popular States Chips */}
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                    Popular States
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_INDIAN_STATES.map((st) => {
                      const isSelected = selectedState.toLowerCase() === st.toLowerCase();
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            setSelectedState(st);
                            setStateStep('district-list');
                            setDistrictSearch('');
                          }}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* State Search Box */}
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    placeholder="Search state or union territory..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-medium text-gray-800 outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Full List of States */}
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1 divide-y divide-gray-50 border border-gray-100 rounded-2xl p-1 bg-white">
                  {filteredStates.map((st) => {
                    const isSelected = selectedState.toLowerCase() === st.toLowerCase();
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setSelectedState(st);
                          setStateStep('district-list');
                          setDistrictSearch('');
                        }}
                        className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between text-left text-xs transition-colors ${
                          isSelected 
                            ? 'bg-emerald-50 font-bold text-emerald-900' 
                            : 'text-gray-700 hover:bg-gray-50 font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Building2 size={14} className={isSelected ? 'text-emerald-600' : 'text-gray-400'} />
                          {st}
                        </span>
                        <ChevronRight size={14} className="text-gray-400" />
                      </button>
                    );
                  })}
                  {filteredStates.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-4">No state matches search</p>
                  )}
                </div>
              </div>
            ) : (
              // Step B: Pick District within selected state
              <div className="space-y-3">
                {/* State Breadcrumb Bar */}
                <div className="flex items-center justify-between bg-emerald-50/80 p-2.5 rounded-2xl border border-emerald-100">
                  <button
                    type="button"
                    onClick={() => setStateStep('state-list')}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    <ChevronLeft size={16} /> All States
                  </button>
                  <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
                    <Building2 size={13} /> {selectedState}
                  </span>
                </div>

                {/* Option 1: Select Entire State */}
                <button
                  type="button"
                  onClick={() => handleSelectEntireState(selectedState)}
                  className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                    !selectedDistrict && currentLocation?.state === selectedState
                      ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                      : 'bg-white border-emerald-200/80 hover:bg-emerald-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Globe size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        Entire {selectedState} (पूरा राज्य)
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Show all products deliverable across all districts in {selectedState}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                    Select State
                  </span>
                </button>

                {/* Option 2: Select Specific District */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Layers size={13} className="text-emerald-600" />
                      Or Choose Your District (जिला चुनें):
                    </label>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {currentDistricts.length} districts in {selectedState}
                    </span>
                  </div>

                  {/* District Search Box */}
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={districtSearch}
                      onChange={(e) => setDistrictSearch(e.target.value)}
                      placeholder={`Search district in ${selectedState}...`}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-8 pr-3 text-xs font-medium text-gray-800 outline-none focus:border-emerald-500 transition-all"
                      autoFocus
                    />
                  </div>

                  {/* District List */}
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-gray-50 border border-gray-100 rounded-2xl p-1 bg-white">
                    {filteredDistricts.map((dist) => {
                      const isSelected = selectedDistrict.toLowerCase() === dist.toLowerCase();
                      return (
                        <button
                          key={dist}
                          type="button"
                          onClick={() => handleSelectDistrict(selectedState, dist)}
                          className={`w-full py-2 px-3 rounded-xl flex items-center justify-between text-left text-xs transition-colors ${
                            isSelected 
                              ? 'bg-emerald-50 font-bold text-emerald-900' 
                              : 'text-gray-700 hover:bg-gray-50 font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <MapPin size={13} className={isSelected ? 'text-emerald-600' : 'text-gray-400'} />
                            {dist}
                          </span>
                          {isSelected ? (
                            <Check size={16} className="text-emerald-600" />
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-bold opacity-0 hover:opacity-100">Select</span>
                          )}
                        </button>
                      );
                    })}
                    {filteredDistricts.length === 0 && (
                      <p className="text-center text-xs text-gray-400 py-4">No district matches search</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleClearLocation}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-colors"
            >
              🌐 Show All India (Remove Location Filter)
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
