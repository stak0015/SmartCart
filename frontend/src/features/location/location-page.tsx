"use client";

import {
  ArrowLeft,
  Bike,
  BusFront,
  CarFront,
  ChevronRight,
  Footprints,
  Info,
  MapPin,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePlanner } from "@/features/planner/planner-provider";
import type { TravelMode } from "@/features/planner/types";

const TRANSPORT_OPTIONS: Array<{ id: TravelMode; label: string; Icon: typeof Footprints; detail: string }> = [
  { id: "walking", label: "Walking", Icon: Footprints, detail: "On foot" },
  { id: "public-transport", label: "Public transport", Icon: BusFront, detail: "Bus or shared route" },
  { id: "motorcycle", label: "Motorcycle", Icon: Bike, detail: "Motorcycle access" },
  { id: "car", label: "Car", Icon: CarFront, detail: "Private car" },
];

const DISTANCE_OPTIONS = [2, 5, 10, 15];

export function LocationPage() {
  const router = useRouter();
  const { basket, travel, updateTravel, clearRememberedTravel, saraPlanningEnabled } = usePlanner();
  const [areaError, setAreaError] = useState(false);

  function compareStores() {
    if (!travel.area.trim()) {
      setAreaError(true);
      return;
    }
    setAreaError(false);
    router.push("/recommendations");
  }

  if (basket.length === 0) {
    return (
      <section className="empty-page">
        <p className="eyebrow">Basket needed</p>
        <h1>Add at least one item first</h1>
        <p>Your travel boundary is used to find one premise that carries your basket.</p>
        <Link className="button button--primary" href="/basket"><ArrowLeft size={17} /> Return to basket</Link>
      </section>
    );
  }

  return (
    <div className="page-shell page-shell--narrow">
      <div className="page-heading">
        <p className="eyebrow">Step 2 of 3</p>
        <h1>What is realistically reachable?</h1>
        <p>Set a starting area, transport mode and maximum distance. SmartCart will keep premises outside that boundary out of your results.</p>
      </div>

      <div className="form-stack">
        <section className="form-card" aria-labelledby="starting-area-title">
          <div className="form-card__heading">
            <span className="icon-tile"><MapPin size={21} aria-hidden="true" /></span>
            <div><p className="section-kicker">Area</p><h2 id="starting-area-title">Starting point</h2></div>
            <span className="story-chip">US 2.1</span>
          </div>
          <label className="field">
            <span>Town, postcode or neighbourhood</span>
            <input
              type="text"
              value={travel.area}
              onChange={(event) => updateTravel({ area: event.target.value })}
              placeholder="e.g. Kota Bharu, Kelantan"
              aria-invalid={areaError}
              aria-describedby={areaError ? "area-error" : "area-privacy"}
            />
            {areaError ? <small className="field-error" id="area-error">Enter an area before comparing stores.</small> : <small id="area-privacy">Use an area rather than a full home address if you prefer.</small>}
          </label>
        </section>

        <fieldset className="form-card">
          <legend className="sr-only">Transport mode</legend>
          <div className="form-card__heading">
            <div><p className="section-kicker">Transport</p><h2>How will you travel?</h2></div>
          </div>
          <div className="choice-grid">
            {TRANSPORT_OPTIONS.map(({ id, label, Icon, detail }) => (
              <label className={`choice-card ${travel.mode === id ? "is-selected" : ""}`} key={id}>
                <input type="radio" name="transport" value={id} checked={travel.mode === id} onChange={() => updateTravel({ mode: id })} />
                <Icon size={24} aria-hidden="true" />
                <span><strong>{label}</strong><small>{detail}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="form-card">
          <legend className="sr-only">Maximum travel distance</legend>
          <div className="form-card__heading form-card__heading--responsive">
            <div><p className="section-kicker">Travel boundary</p><h2>Maximum distance</h2></div>
            <span className="boundary-readout">Up to <strong>{travel.maxDistanceKm} km</strong></span>
          </div>
          <p className="supporting-text">Only premises at or inside this illustrative route distance will be evaluated.</p>
          <div className="segmented-options">
            {DISTANCE_OPTIONS.map((distance) => (
              <label className={travel.maxDistanceKm === distance ? "is-selected" : ""} key={distance}>
                <input type="radio" name="distance" value={distance} checked={travel.maxDistanceKm === distance} onChange={() => updateTravel({ maxDistanceKm: distance })} />
                <span>{distance} km</span>
              </label>
            ))}
          </div>
        </fieldset>

        <section className="form-card form-card--soft" aria-labelledby="preferences-title">
          <div className="form-card__heading">
            <span className="icon-tile icon-tile--soft"><ShieldCheck size={21} aria-hidden="true" /></span>
            <div><p className="section-kicker">Privacy and support</p><h2 id="preferences-title">Optional preferences</h2></div>
          </div>
          <label className="check-card check-card--plain">
            <input type="checkbox" checked={travel.rememberOnDevice} onChange={(event) => updateTravel({ rememberOnDevice: event.target.checked })} />
            <span><strong>Remember these travel preferences on this device</strong><small>No account is required. Leave this off on a shared device.</small></span>
          </label>
          <label className={`check-card check-card--plain ${!saraPlanningEnabled ? "is-muted" : ""}`}>
            <input type="checkbox" checked={travel.saraPartnersOnly} disabled={!saraPlanningEnabled} onChange={(event) => updateTravel({ saraPartnersOnly: event.target.checked })} />
            <span><strong>Only show verified SARA partner premises</strong><small>{saraPlanningEnabled ? "Premises with unknown status will be excluded." : "Enable SARA planning in your basket to use this filter."}</small></span>
          </label>
          {travel.rememberOnDevice && (
            <button type="button" className="text-button text-button--danger" onClick={clearRememberedTravel}><Trash2 size={16} /> Clear saved travel preferences</button>
          )}
          <div className="privacy-note"><Info size={18} aria-hidden="true" /><p>Coordinates and route calculations are not stored in the current database. A mapping provider will be integrated later under its privacy, caching and attribution rules.</p></div>
        </section>
      </div>

      <div className="form-actions">
        <Link className="button button--secondary" href="/basket"><ArrowLeft size={17} aria-hidden="true" /> Back to basket</Link>
        <button className="button button--primary" type="button" onClick={compareStores}>Compare reachable stores <ChevronRight size={18} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
