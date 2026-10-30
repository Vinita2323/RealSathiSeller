import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CustomDatePicker = ({ value, onChange, disabled, placeholder = 'Select Date', position = 'top' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'month' | 'year'
  const containerRef = useRef(null);
  const yearListRef = useRef(null);

  // Parse input value (YYYY-MM-DD)
  const initialDate = value ? new Date(value) : new Date(1995, 7, 15);
  const isValidDate = !isNaN(initialDate.getTime());

  const [selectedDate, setSelectedDate] = useState(isValidDate ? initialDate : new Date(1995, 7, 15));
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());

  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setViewMonth(parsed.getMonth());
        setViewYear(parsed.getFullYear());
      }
    }
  }, [value]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setViewMode('calendar');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format display string e.g. "15 August 1995"
  const formatDisplay = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthName = MONTH_NAMES[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${day} ${monthName} ${year}`;
  };

  // Days calculations
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const daysInCurrentMonth = getDaysInMonth(viewMonth, viewYear);
  const firstDayOfWeek = getFirstDayOfMonth(viewMonth, viewYear);

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    calendarCells.push(d);
  }

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day) => {
    if (!day) return;
    const newDate = new Date(viewYear, viewMonth, day);
    setSelectedDate(newDate);
    
    // Format YYYY-MM-DD
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    const dd = String(newDate.getDate()).padStart(2, '0');
    const formattedStr = `${yyyy}-${mm}-${dd}`;
    
    if (onChange) {
      onChange({ target: { name: 'dob', value: formattedStr } });
    }
    setIsOpen(false);
    setViewMode('calendar');
  };

  // Years list (currentYear down to 1940)
  const currentYear = new Date().getFullYear();
  const yearsList = [];
  for (let y = currentYear; y >= 1940; y--) {
    yearsList.push(y);
  }

  // Scroll active year into view when year selector opens
  useEffect(() => {
    if (viewMode === 'year' && yearListRef.current) {
      const activeEl = yearListRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'center' });
      }
    }
  }, [viewMode]);

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Display Field */}
      <div 
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setViewMode('calendar');
          }
        }}
        className={`w-full bg-[#f8fafc] border rounded-[16px] py-3.5 pl-12 pr-4 text-[14px] font-semibold text-slate-800 flex items-center justify-between cursor-pointer transition-all ${
          disabled ? 'opacity-70 bg-slate-50 cursor-not-allowed border-slate-200' : 'hover:border-slate-300 focus:border-[#ea580c] focus:bg-white border-slate-200'
        } ${isOpen ? 'border-[#ea580c] ring-2 ring-orange-500/10 bg-white' : ''}`}
      >
        <span className={selectedDate ? 'text-slate-900 font-bold' : 'text-slate-400 font-normal'}>
          {selectedDate ? formatDisplay(selectedDate) : placeholder}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-[#ea580c]' : ''}`} />
      </div>

      {/* Custom Popup DatePicker Modal / Card */}
      {isOpen && (
        <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 z-[200] w-[310px] bg-white rounded-2xl p-4 shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-slate-100 animate-fade-in-up`}>
          
          {/* Header Controls */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              {/* Custom Month Toggle Button */}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'month' ? 'calendar' : 'month')}
                className={`py-1 px-2.5 rounded-lg text-[13px] font-extrabold flex items-center gap-1 border border-slate-200/80 cursor-pointer transition-colors ${
                  viewMode === 'month' ? 'bg-[#ea580c] text-white border-[#ea580c]' : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <span>{MONTH_NAMES[viewMonth]}</span>
                <ChevronDown size={12} className={viewMode === 'month' ? 'rotate-180' : ''} />
              </button>

              {/* Custom Year Toggle Button */}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'year' ? 'calendar' : 'year')}
                className={`py-1 px-2.5 rounded-lg text-[13px] font-extrabold flex items-center gap-1 border border-slate-200/80 cursor-pointer transition-colors ${
                  viewMode === 'year' ? 'bg-[#ea580c] text-white border-[#ea580c]' : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <span>{viewYear}</span>
                <ChevronDown size={12} className={viewMode === 'year' ? 'rotate-180' : ''} />
              </button>
            </div>

            {viewMode === 'calendar' && (
              <div className="flex items-center gap-1">
                <button 
                  type="button" 
                  onClick={handlePrevMonth}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200/80 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  type="button" 
                  onClick={handleNextMonth}
                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200/80 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* VIEW MODE 1: CALENDAR DAYS */}
          {viewMode === 'calendar' && (
            <>
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {DAYS_OF_WEEK.map((day) => (
                  <span key={day} className="text-[11px] font-extrabold text-slate-400 uppercase py-1">
                    {day}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarCells.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="h-8"></div>;
                  }

                  const isSelected = 
                    selectedDate &&
                    selectedDate.getDate() === day &&
                    selectedDate.getMonth() === viewMonth &&
                    selectedDate.getFullYear() === viewYear;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      className={`h-8 rounded-full flex items-center justify-center text-[12px] font-bold border-none transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#ea580c] text-white shadow-md shadow-orange-500/30'
                          : 'text-slate-700 hover:bg-orange-50 hover:text-[#ea580c]'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* VIEW MODE 2: MONTH SELECTOR */}
          {viewMode === 'month' && (
            <div className="grid grid-cols-3 gap-2 py-1">
              {MONTH_NAMES.map((m, idx) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setViewMonth(idx);
                    setViewMode('calendar');
                  }}
                  className={`py-2.5 rounded-xl text-[12px] font-bold border-none cursor-pointer transition-all ${
                    idx === viewMonth 
                      ? 'bg-[#ea580c] text-white shadow-md shadow-orange-500/20' 
                      : 'bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-[#ea580c]'
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {/* VIEW MODE 3: YEAR SELECTOR (Contained scrollable inside card) */}
          {viewMode === 'year' && (
            <div 
              ref={yearListRef}
              className="max-h-[190px] overflow-y-auto grid grid-cols-3 gap-2 p-1 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full"
            >
              {yearsList.map((y) => {
                const isSelectedYear = y === viewYear;
                return (
                  <button
                    key={y}
                    type="button"
                    data-selected={isSelectedYear}
                    onClick={() => {
                      setViewYear(y);
                      setViewMode('calendar');
                    }}
                    className={`py-2 rounded-xl text-[13px] font-extrabold border-none cursor-pointer transition-all ${
                      isSelectedYear 
                        ? 'bg-[#ea580c] text-white shadow-md shadow-orange-500/20' 
                        : 'bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-[#ea580c]'
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
