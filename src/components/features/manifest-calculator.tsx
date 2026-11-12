"use client";

import React, { useState } from "react";

export function ManifestCalculator() {
  const [price, setPrice] = useState<number>(24);
  const [qty, setQty] = useState<number>(200);

  const goodsVal = Math.max(0, price || 0) * Math.max(1, qty || 1);
  const duty = goodsVal * 0.075;
  const mpf = Math.min(Math.max(goodsVal * 0.003464, 33), 651);
  const totalAtBorder = duty + mpf;

  const usd = (n: number) =>
    "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div
      className="manifest bg-card text-text border border-line shadow-2xl relative select-none"
      aria-label="Landed cost preview calculator"
    >
      {/* Top Meta */}
      <div className="flex justify-between items-center text-[12.5px] text-mute mb-3.5">
        <span className="font-medium">Landed cost preview</span>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-bg text-mute border border-line">
          Illustrative rates
        </span>
      </div>

      {/* Corridor Route */}
      <div className="route flex items-center gap-2.5 font-heading font-bold text-[19px] text-text mb-4">
        <span>India</span>
        <div className="ln flex-1 relative border-t-2 border-dashed border-line"></div>
        <span>United States</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="text-xs text-mute font-semibold flex flex-col gap-1">
          <span>Price per unit (USD)</span>
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-3 py-2 border-1.5 border-line rounded-[9px] bg-bg text-text font-medium text-sm focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20 transition-all"
          />
        </label>
        <label className="text-xs text-mute font-semibold flex flex-col gap-1">
          <span>Units</span>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="w-full px-3 py-2 border-1.5 border-line rounded-[9px] bg-bg text-text font-medium text-sm focus:outline-none focus:border-sea focus:ring-2 focus:ring-sea/20 transition-all"
          />
        </label>
      </div>

      {/* Calculation Rows */}
      <div className="space-y-1.5 border-t border-dashed border-line pt-2 text-sm">
        <div className="flex justify-between py-1.5 border-b border-dashed border-line">
          <span className="text-mute">Goods value</span>
          <span className="font-mono font-semibold text-text">{usd(goodsVal)}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-dashed border-line">
          <span className="text-mute">Duty (7.5% sample)</span>
          <span className="font-mono font-semibold text-text">{usd(duty)}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-dashed border-line">
          <span className="text-mute">Merchandise processing fee</span>
          <span className="font-mono font-semibold text-text">{usd(mpf)}</span>
        </div>
      </div>

      {/* Border Total */}
      <div className="flex justify-between items-baseline mt-4 pt-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-mute">
          You pay at the border
        </span>
        <b className="font-heading text-3xl font-extrabold text-sea tracking-tight">
          {usd(totalAtBorder)}
        </b>
      </div>

      {/* Tilted Stamp Badge */}
      <span className="stamp absolute -bottom-3 right-4 shadow-sm">
        NO SURPRISES
      </span>
    </div>
  );
}

