import React from 'react';
import discountPromoIcon from "@food/assets/category-icons/discount_promo.png";
import vegPromoIcon from "@food/assets/category-icons/veg_promo.png";
import pricePromoIcon from "@food/assets/category-icons/price_promo.png";
import comboPromoIcon from "@food/assets/category-icons/combo_promo.png";

export default function PromoRow({ handleVegModeChange, navigate, isVegMode, toggleRef }) {
  const promoCardsData = [
    {
      id: 'offers',
      title: "MIN.",
      value: "40% off",
      icon: discountPromoIcon,
      bgColor: "bg-rose-50 dark:bg-rose-950/30",
      borderColor: "border-rose-100 dark:border-rose-900/60",
      textColor: "text-rose-600 dark:text-rose-300",
    },
    {
      id: 'pure-veg',
      title: "PURE",
      value: "Veg",
      icon: vegPromoIcon,
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
      borderColor: "border-emerald-100 dark:border-emerald-900/60",
      textColor: "text-emerald-600 dark:text-emerald-300",
    },
    {
      id: 'under-250',
      title: "UNDER",
      value: "\u20B9250",
      icon: pricePromoIcon,
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
      borderColor: "border-amber-100 dark:border-amber-900/60",
      textColor: "text-amber-600 dark:text-amber-300",
    },
    {
      id: 'combos',
      title: "BEST",
      value: "Combos",
      icon: comboPromoIcon,
      bgColor: "bg-sky-50 dark:bg-sky-950/30",
      borderColor: "border-sky-100 dark:border-sky-900/60",
      textColor: "text-sky-600 dark:text-sky-300",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 px-4 pt-4 pb-8 bg-white dark:bg-[#0a0a0a]">
      {promoCardsData.map((promo, idx) => (
        <div
          key={idx}
          ref={promo.id === 'pure-veg' ? toggleRef : null}
          className={`${promo.bgColor} ${promo.borderColor} rounded-[2rem] p-1 flex flex-col items-center h-[170px] shadow-sm border transition-all duration-300 cursor-pointer active:scale-95 group ${
            promo.id === 'pure-veg' && isVegMode ? 'ring-2 ring-emerald-500 bg-emerald-100 dark:bg-emerald-900/50' : ''
          }`}
          onClick={() => {
            if (promo.id === 'pure-veg') handleVegModeChange(!isVegMode);
            else if (promo.id === 'offers') navigate('/food/user/offers');
            else if (promo.id === 'under-250') navigate('/food/user/under-250');
          }}
        >
          <div className="py-3 px-1 flex flex-col items-center text-center">
            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 tracking-[0.1em] uppercase leading-none mb-1">
              {promo.title}
            </span>
            <span className={`text-sm font-black ${promo.textColor} leading-none truncate w-full px-1`}>
              {promo.value}
            </span>
          </div>

          <div className="flex-1 w-full bg-white dark:bg-[#1a1a1a] rounded-[1.8rem] shadow-inner flex items-center justify-center p-2 mt-auto mb-1 group-hover:p-1 transition-all duration-300 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <img
              src={promo.icon}
              alt={promo.value}
              className="w-full h-full object-contain drop-shadow-md transform group-hover:scale-110 transition-transform duration-500"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
