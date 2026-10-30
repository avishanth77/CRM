import React, { useState, useEffect, useRef } from 'react';
import { Globe, MapPin, Building, Navigation, ChevronDown, Search, X } from 'lucide-react';
import { 
  getAllCountries, 
  getStatesForCountry, 
  getCitiesForState, 
  normalizeCountryName 
} from '../../services/locationData';

export interface TerritoryOption {
  id: string;
  name: string;
  country?: string | null;
  regional_manager_name?: string | null;
  [key: string]: any;
}

export interface LocationHierarchySelectorProps {
  country: string;
  onCountryChange: (country: string) => void;
  state: string;
  onStateChange: (state: string) => void;
  city: string;
  onCityChange: (city: string) => void;
  territory?: string;
  onTerritoryChange?: (territory: string) => void;
  territories?: TerritoryOption[];
  showTerritory?: boolean;
  territoryLabel?: string;
  territoryHelperText?: string;
  address?: string;
  onAddressChange?: (address: string) => void;
  showAddress?: boolean;
  addressLabel?: string;
  addressPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  variant?: 'grid' | 'stacked' | 'horizontal-2col';
}

export const LocationHierarchySelector: React.FC<LocationHierarchySelectorProps> = ({
  country,
  onCountryChange,
  state,
  onStateChange,
  city,
  onCityChange,
  territory = '',
  onTerritoryChange,
  territories = [],
  showTerritory = true,
  territoryLabel = 'Region / Territory',
  territoryHelperText,
  address = '',
  onAddressChange,
  showAddress = false,
  addressLabel = 'Street Address / Building / Office Location',
  addressPlaceholder = 'e.g. King Fahd Road, Al-Olaya Tower, Floor 4, Suite 402',
  required = false,
  disabled = false,
  variant = 'horizontal-2col'
}) => {
  // Country Dropdown state
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  // Custom entry modes
  const [isCustomState, setIsCustomState] = useState(false);
  const [isCustomCity, setIsCustomCity] = useState(false);

  // Available data lists based on selection
  const countries = getAllCountries();
  const availableStates = getStatesForCountry(country);
  const availableCities = getCitiesForState(country, state);

  // Sync custom flags if value doesn't exist in standard list
  useEffect(() => {
    if (state && availableStates.length > 0 && !availableStates.includes(state)) {
      setIsCustomState(true);
    } else if (!state) {
      setIsCustomState(false);
    }
  }, [country, state, availableStates.length]);

  useEffect(() => {
    if (city && availableCities.length > 0 && !availableCities.includes(city)) {
      setIsCustomCity(true);
    } else if (!city) {
      setIsCustomCity(false);
    }
  }, [state, city, availableCities.length]);

  // Handle clicking outside to close country dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(event.target as Node)) {
        setIsCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter countries by search term
  const filteredCountries = countries.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Handler: Country change (cascades reset to state & city)
  const handleSelectCountry = (countryName: string) => {
    if (countryName !== country) {
      onCountryChange(countryName);
      onStateChange('');
      onCityChange('');
      setIsCustomState(false);
      setIsCustomCity(false);
    }
    setIsCountryOpen(false);
    setCountrySearch('');
  };

  // Handler: State change (cascades reset to city)
  const handleStateSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setIsCustomState(true);
      onStateChange('');
      onCityChange('');
    } else {
      setIsCustomState(false);
      if (val !== state) {
        onStateChange(val);
        onCityChange('');
        setIsCustomCity(false);
      }
    }
  };

  // Handler: City change
  const handleCitySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__CUSTOM__') {
      setIsCustomCity(true);
      onCityChange('');
    } else {
      setIsCustomCity(false);
      onCityChange(val);
    }
  };

  const currentCountryObj = countries.find(
    c => c.name.toLowerCase() === (country || '').toLowerCase() || 
         c.name.toLowerCase() === normalizeCountryName(country).toLowerCase()
  );

  const containerStyle = variant === 'horizontal-2col' 
    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }
    : variant === 'grid'
    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }
    : { display: 'flex', flexDirection: 'column' as const, gap: '12px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={containerStyle}>
        
        {/* 1. COUNTRY SELECTION */}
        <div style={{ position: 'relative' }} ref={countryRef}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
            <Globe size={13} color="var(--primary)" />
            <span>Country</span>
            {required && <span style={{ color: '#EF4444' }}>*</span>}
          </label>

          <div
            onClick={() => !disabled && setIsCountryOpen(!isCountryOpen)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: country ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.82rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: '38px',
              opacity: disabled ? 0.6 : 1,
              userSelect: 'none'
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentCountryObj ? currentCountryObj.name : (country || 'Select Country...')}
            </span>
            <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isCountryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </div>

          {/* Searchable Dropdown Menu */}
          {isCountryOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 9999,
              marginTop: '4px',
              background: 'var(--bg-surface-elevated, #181c24)',
              border: '1px solid var(--border-subtle, #2d3748)',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
              maxHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Search input inside dropdown */}
              <div style={{ padding: '8px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search countries..."
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    outline: 'none'
                  }}
                />
                {countrySearch && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCountrySearch(''); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Country List Options */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
                {filteredCountries.length === 0 ? (
                  <div style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    No matching country found.
                    <div style={{ marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleSelectCountry(countrySearch.trim())}
                        style={{
                          background: 'var(--primary)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '0.74rem',
                          cursor: 'pointer'
                        }}
                      >
                        Use "{countrySearch.trim()}"
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredCountries.map(c => {
                    const isSelected = country.toLowerCase() === c.name.toLowerCase() || country.toLowerCase() === c.code.toLowerCase();
                    return (
                      <div
                        key={c.code}
                        onClick={() => handleSelectCountry(c.name)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '5px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                          fontWeight: isSelected ? 600 : 400
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span>{c.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.code}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. STATE / PROVINCE SELECTION */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Building size={13} color="var(--primary)" />
              <span>State / Province</span>
              {required && <span style={{ color: '#EF4444' }}>*</span>}
            </label>
            {availableStates.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsCustomState(!isCustomState);
                  if (!isCustomState) onStateChange('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {isCustomState ? 'Choose from list' : '+ Custom'}
              </button>
            )}
          </div>

          {!country ? (
            <div
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                minHeight: '38px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              Select Country first
            </div>
          ) : isCustomState || availableStates.length === 0 ? (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder={availableStates.length === 0 ? "Enter State / Province / Division" : "Enter custom state name"}
                value={state}
                disabled={disabled}
                onChange={(e) => {
                  onStateChange(e.target.value);
                  onCityChange(''); // Reset city on manual state change
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
              {availableStates.length === 0 && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Manual entry supported for all international subdivisions
                </div>
              )}
            </div>
          ) : (
            <select
              value={state}
              disabled={disabled}
              onChange={handleStateSelectChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: state ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            >
              <option value="">-- Select State / Province ({availableStates.length}) --</option>
              {availableStates.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
              <option value="__CUSTOM__">+ Add Custom State / Province...</option>
            </select>
          )}
        </div>

        {/* 3. CITY / PLACE SELECTION */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Navigation size={13} color="var(--primary)" />
              <span>City / Place</span>
              {required && <span style={{ color: '#EF4444' }}>*</span>}
            </label>
            {availableCities.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsCustomCity(!isCustomCity);
                  if (!isCustomCity) onCityChange('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {isCustomCity ? 'Choose from list' : '+ Custom'}
              </button>
            )}
          </div>

          {!state ? (
            <div
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                minHeight: '38px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              Select State / Province first
            </div>
          ) : isCustomCity || availableCities.length === 0 ? (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder={availableCities.length === 0 ? "Enter City / Town / Place" : "Enter custom city name"}
                value={city}
                disabled={disabled}
                onChange={(e) => onCityChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
              {availableCities.length === 0 && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Manual entry for city, municipality, or local place
                </div>
              )}
            </div>
          ) : (
            <select
              value={city}
              disabled={disabled}
              onChange={handleCitySelectChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: city ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            >
              <option value="">-- Select City / Place ({availableCities.length}) --</option>
              {availableCities.map(ct => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
              <option value="__CUSTOM__">+ Add Custom City / Place...</option>
            </select>
          )}
        </div>

        {/* 4. REGION / TERRITORY (EXISTING IMPLEMENTATION PRESERVED) */}
        {showTerritory && onTerritoryChange && (
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
              <MapPin size={13} color="#4F46E5" />
              <span>{territoryLabel}</span>
            </label>
            <select
              value={territory}
              disabled={disabled}
              onChange={(e) => onTerritoryChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: territory ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            >
              <option value="">-- Select Region / Territory (Admin Defined) --</option>
              {territories.map(t => (
                <option key={t.id} value={t.name}>
                  {t.name} {t.country ? `(${t.country})` : ''} {t.regional_manager_name ? `• Mgr: ${t.regional_manager_name}` : ''}
                </option>
              ))}
            </select>
            {territoryHelperText && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {territoryHelperText}
              </div>
            )}
          </div>
        )}

        {/* 5. STREET / OFFICE / BUILDING ADDRESS (OPTIONAL) */}
        {showAddress && onAddressChange && (
          <div style={{ gridColumn: variant === 'horizontal-2col' ? '1 / -1' : undefined }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
              <Navigation size={13} color="#4F46E5" />
              <span>{addressLabel}</span>
            </label>
            <input
              type="text"
              value={address}
              disabled={disabled}
              placeholder={addressPlaceholder}
              onChange={(e) => onAddressChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
};
