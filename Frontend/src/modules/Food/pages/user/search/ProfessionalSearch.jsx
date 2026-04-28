import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useSearchParams, Link, useNavigate, useLocation } from "react-router-dom"
import { 
  ArrowLeft, Star, Clock, Search, SlidersHorizontal, 
  ChevronDown, Bookmark, BadgePercent, Mic, Grid2x2,
  X, Utensils, Store, Loader2, History, Leaf
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Switch } from "@food/components/ui/switch"
import { useProfile } from "@food/context/ProfileContext"
import { useLocation as useGeoLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { searchAPI } from "@/services/api"
import { motion, AnimatePresence } from "framer-motion"

// Helper to resolve media URLs consistently
const getMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http')) return url;
  
  // Use VITE_API_BASE_URL to derive the backend origin
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
  const origin = apiBase.split('/api/v1')[0];
  
  return `${origin}${url.startsWith('/') ? url : '/' + url}`;
};

// Debounce hook for real-time search
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

const SEARCH_HISTORY_KEY = "professional_search_history_v1"

export default function ProfessionalSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get("q") || ""
  const navigate = useNavigate()
  const location = useLocation()
  const { location: userCoords } = useGeoLocation()
  const { zoneId } = useZone(userCoords)
  const { vegMode, setVegMode } = useProfile()
  
  const [query, setQuery] = useState(initialQuery)
  const debouncedQuery = useDebounce(query, 500)
  
  const [results, setResults] = useState({ restaurants: [], dishes: [] })
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get("cat") || null)
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [history, setHistory] = useState([])

  // Trigger voice search on mount if navigated from home mic
  useEffect(() => {
    if (location.state?.startVoice) {
      const timer = setTimeout(() => {
        handleVoiceSearch()
        // Clean up state to prevent re-triggering
        navigate(location.pathname, { replace: true, state: {} })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [location.state, navigate, location.pathname])

  // Load search history
  useEffect(() => {
    const savedHistory = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (savedHistory) setHistory(JSON.parse(savedHistory))
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await searchAPI.getAdminCategories({ zoneId })
      if (res.data?.success) setCategories(res.data.data.categories)
    } catch (err) {
      console.error("Failed to fetch categories", err)
    }
  }

  const addToHistory = (term) => {
    const newHistory = [term, ...history.filter(h => h !== term)].slice(0, 5)
    setHistory(newHistory)
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory))
  }

  const performSearch = useCallback(async (searchTerm, catId, isVeg, filters) => {
    if (!searchTerm && !catId) {
      setResults({ restaurants: [], dishes: [] })
      return
    }
    
    setLoading(true)
    try {
      const res = await searchAPI.unifiedSearch({
        q: searchTerm,
        categoryId: catId,
        lat: userCoords?.latitude,
        lng: userCoords?.longitude,
        zoneId,
        vegOnly: isVeg // Pass to API
      })
      
      if (res.data?.success) {
        // Grouping results into Restaurants and potential Dishes
        const all = res.data.data.restaurants || []
        
        // Local filtering as backup/perfection
        const restaurants = all.filter(r => {
          if (r.matchType === 'food') return false
          if (isVeg && !r.pureVegRestaurant && !r.isVeg) return false
          
          if (filters?.has('rating-4-plus') && (Number(r.rating) || 0) < 4.0) return false
          if (filters?.has('delivery-under-30')) {
             const timeMatch = String(r.estimatedDeliveryTime || "30").match(/(\d+)/)
             if (timeMatch && parseInt(timeMatch[1]) >= 30) return false
          }
          return true
        })
        
        const dishes = all.filter(r => {
          if (r.matchType !== 'food') return false
          if (isVeg && !r.isVeg && !r.pureVegRestaurant) return false
          return true
        })

        setResults({ restaurants, dishes })
      }
    } catch (err) {
      console.error("Search failed", err)
    } finally {
      setLoading(false)
    }
  }, [userCoords, zoneId])

  useEffect(() => {
    performSearch(debouncedQuery, selectedCategoryId, vegMode, activeFilters)
    if (debouncedQuery) {
        setSearchParams({ 
          q: debouncedQuery, 
          ...(selectedCategoryId ? { cat: selectedCategoryId } : {}),
          ...(vegMode ? { veg: '1' } : {})
        }, { replace: true })
    }
  }, [debouncedQuery, selectedCategoryId, vegMode, activeFilters, performSearch, setSearchParams])

  // Speech Recognition Implementation
  const handleVoiceSearch = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition;
    if (!SpeechRecognition) return;

    // Trigger phone's native permission request prompt
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err) {
      // Fail silently for cleaner console
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      addToHistory(transcript);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Mic start failed", e);
    }
  }

  const handleClear = () => {
    setQuery("")
    setSelectedCategoryId(null)
    setSearchParams({}, { replace: true })
    setResults({ restaurants: [], dishes: [] })
  }

  const handleCategoryClick = (id) => {
    const newCat = selectedCategoryId === id ? null : id
    setSelectedCategoryId(newCat)
    if (newCat) {
        setSearchParams({ ...Object.fromEntries(searchParams), cat: newCat }, { replace: true })
    } else {
        const p = Object.fromEntries(searchParams)
        delete p.cat
        setSearchParams(p, { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-md transition-all duration-300">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-zinc-300" />
            </button>
            
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <Input 
                autoFocus
                placeholder="Search for restaurants or dishes..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-11 pr-11 h-12 bg-slate-100 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-rose-500 rounded-2xl w-full text-base font-medium shadow-inner"
              />
              {query && (
                <button onClick={handleClear} className="absolute right-11 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-rose-500 transition-colors z-10">
                  <X className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={handleVoiceSearch}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all z-10 ${isListening ? 'text-white bg-rose-500 scale-105 shadow-lg shadow-rose-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Mic className={`w-5.5 h-5.5 ${isListening ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sticky Filtering Controls - Matching Desktop Design */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-800/80 pl-2 pr-4 py-1.5 rounded-full border border-slate-100 dark:border-zinc-700/50 shadow-sm transition-all hover:border-green-500/30">
                <div className={`p-1 rounded-full ${vegMode ? 'bg-green-50' : 'bg-transparent'}`}>
                    <Leaf className={`h-4 w-4 ${vegMode ? 'text-green-600 fill-green-600' : 'text-slate-400'}`} />
                </div>
                <div className="flex flex-col -space-y-0.5">
                    <span className={`text-[11px] font-semibold uppercase tracking-wide ${vegMode ? 'text-green-600' : 'text-slate-400'}`}>Veg</span>
                    <span className={`text-[10px] font-semibold ${vegMode ? 'text-green-600' : 'text-slate-500'} dark:text-zinc-400 leading-none tracking-wide`}>Only</span>
                </div>
                <Switch 
                  checked={vegMode} 
                  onCheckedChange={setVegMode}
                  className="scale-90 data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-zinc-400 ml-1 shadow-sm"
                />
            </div>

            {/* Quick Suggestions / Filter Chips */}
            <div className="flex-1 flex overflow-x-auto scrollbar-hide gap-2 py-0.5 px-1">
                {[
                    { id: 'rating-4-plus', label: '4.0+ Star' },
                    { id: 'delivery-under-30', label: '< 30 mins' }
                ].map(chip => {
                    const isActive = activeFilters.has(chip.id);
                    return (
                        <button
                            key={chip.id}
                            onClick={() => {
                                setActiveFilters(prev => {
                                    const next = new Set(prev);
                                    if (next.has(chip.id)) next.delete(chip.id);
                                    else next.add(chip.id);
                                    return next;
                                });
                            }}
                            className={`px-3 py-1.5 rounded-full border text-[11px] font-bold whitespace-nowrap active:scale-95 transition-all shadow-sm ${isActive ? 'bg-rose-500 border-rose-500 text-white hover:bg-rose-600' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50'}`}
                        >
                            {chip.label}
                        </button>
                    )
                })}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {/* Categories (Admin only) */}
        {!query && !loading && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 px-1">Top Categories</h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
              {categories.map((cat) => (
                <button 
                  key={cat._id} 
                  onClick={() => handleCategoryClick(cat._id)}
                  className={`flex flex-col items-center group transition-all ${selectedCategoryId === cat._id ? 'scale-110' : ''}`}
                >
                  <div className={`w-14 h-14 rounded-2xl mb-2 flex items-center justify-center overflow-hidden border-2 transition-all ${selectedCategoryId === cat._id ? 'border-rose-500 shadow-lg shadow-rose-100' : 'border-transparent bg-white dark:bg-zinc-900'}`}>
                    {cat.image ? (
                      <img 
                        src={getMediaUrl(cat.image)} 
                        alt={cat.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                      />
                    ) : (
                      <Utensils className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <span className={`text-[11px] font-medium text-center line-clamp-1 ${selectedCategoryId === cat._id ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400'}`}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        <AnimatePresence>
          {loading && (
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="flex flex-col items-center justify-center py-20"
            >
              <Loader2 className="w-8 h-8 text-rose-500 animate-spin mb-3" />
              <p className="text-slate-400 text-sm">Finding the best for you...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent History */}
        {!query && !loading && history.length > 0 && (
          <div className="mb-8">
             <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Recently Searched</h3>
             <div className="flex flex-wrap gap-2">
                {history.map((term, i) => (
                  <button 
                    key={i} 
                    onClick={() => setQuery(term)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-50 transition-colors"
                  >
                    <History className="w-3 h-3" />
                    {term}
                  </button>
                ))}
             </div>
          </div>
        )}

        {/* Search Results */}
        {!loading && (query || selectedCategoryId) && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Dish Results Section */}
            {results.dishes.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                   <div className="w-1 h-5 bg-orange-500 rounded-full" />
                   <h2 className="text-lg font-bold dark:text-white">Dishes from restaurants</h2>
                </div>
                <div className="grid gap-4">
                  {results.dishes.map((r) => (
                    <Link to={`/user/restaurants/${r.slug || r._id}${r.matchedDishId ? `?dish=${r.matchedDishId}` : ''}`} key={r._id} className="flex gap-4 p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 hover:shadow-md transition-shadow group">
                       <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 relative">
                           <img 
                            src={getMediaUrl(r.matchedDishImage || r.profileImage || r.image || (Array.isArray(r.images) && r.images[0]))} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            onError={(e) => (e.target.src = "/placeholder-dish.jpg")}
                          />
                          {r.pureVegRestaurant && (
                            <div className="absolute top-1 left-1 w-4 h-4 border-2 border-green-600 p-[2px] bg-white rounded">
                               <div className="w-full h-full bg-green-600 rounded-full" />
                            </div>
                          )}
                       </div>
                       <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="text-rose-500 text-[10px] font-bold uppercase tracking-wider mb-1">
                             Matched: {r.matchedDish || query}
                          </div>
                          <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{r.restaurantName}</h3>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 mt-1">
                             <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                                <span className="font-semibold text-slate-700 dark:text-white">{r.rating || "New"}</span>
                             </div>
                             <span>•</span>
                             <span>{r.estimatedDeliveryTime || "30-40 mins"}</span>
                             <span>•</span>
                             <span className="line-clamp-1">{r.cuisines?.slice(0, 2).join(", ")}</span>
                          </div>
                       </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Restaurant Results Section */}
            {results.restaurants.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                   <div className="w-1 h-5 bg-rose-500 rounded-full" />
                   <h2 className="text-lg font-bold dark:text-white">Restaurants</h2>
                </div>
                <div className="grid gap-6">
                  {results.restaurants.map((r) => (
                    <Link to={`/user/restaurants/${r._id}`} key={r._id} className="block group">
                      <div className="relative rounded-3xl overflow-hidden aspect-[16/9] mb-3 bg-slate-200">
                         <img 
                          src={getMediaUrl(r.profileImage || r.image || (Array.isArray(r.images) && r.images[0]))} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => (e.target.src = "/placeholder-restaurant.jpg")}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                           <div>
                              <h3 className="text-xl font-bold text-white mb-1">{r.restaurantName}</h3>
                              <p className="text-white/80 text-xs line-clamp-1">{r.cuisines?.join(", ")}</p>
                           </div>
                           <div className="bg-white/20 backdrop-blur-md border border-white/30 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Star className="w-3 h-3 text-white fill-white" />
                              <span className="text-white text-xs font-bold">{r.rating || "4.0"}</span>
                           </div>
                        </div>
                        {r.offer && (
                           <div className="absolute top-4 left-0 bg-blue-600 text-white text-[10px] font-black px-3 py-1.5 rounded-r-lg shadow-lg flex items-center gap-1 tracking-tighter">
                              <BadgePercent className="w-3 h-3" />
                              {r.offer.toUpperCase()}
                           </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-1">
                         <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                            <div className="flex items-center gap-1">
                               <Clock className="w-3 h-3" />
                               {r.estimatedDeliveryTime || "30 mins"}
                            </div>
                            <span>•</span>
                            <span>{r.location?.area || "Nearby"}</span>
                         </div>
                         <div className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Top Pick
                         </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {!loading && results.restaurants.length === 0 && results.dishes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                 <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-slate-300" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">We couldn't find any results</h2>
                 <p className="text-slate-500 text-sm max-w-xs">Maybe try searching for something else or check your spelling</p>
                 <Button variant="outline" onClick={handleClear} className="mt-6 rounded-xl border-rose-500 text-rose-500 hover:bg-rose-50">
                    Clear all filters
                 </Button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
