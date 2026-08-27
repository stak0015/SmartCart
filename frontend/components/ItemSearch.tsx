"use client";

import { useState } from "react";
import { searchItems, type Item } from "@/lib/api";

/**
 * Item Search Component: Input field + live results list + no-results/loading/error states
 * Corresponds to AC-1.1.1: Users can search for items
 */
export default function ItemSearch() {
  const [query, setQuery] = useState("");      // Text in the input field
  const [results, setResults] = useState<Item[]>([]);  // Search results
  const [loading, setLoading] = useState(false);       // Whether a request is in progress
  const [error, setError] = useState<string | null>(null); // Error message
  const [searched, setSearched] = useState(false);     // Whether a search has been performed (to distinguish "not yet searched" from "searched but no results")

  // Triggered when user clicks the search button or presses Enter
  const handleSearch = async () => {
    setError(null);
    setSearched(true);

    // Empty input: clear results directly without sending a request
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const data = await searchItems(query, 20);
      setResults(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search error");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-3">🔍 Search Items</h2>

      {/* Search input + button */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Enter item name or category, e.g. ayam, milk..."
          className="flex-1 border rounded px-3 py-2 text-black"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-red-500 mb-3">⚠️ {error}</div>
      )}

      {/* Loading state */}
      {loading && <div className="text-gray-500">Searching...</div>}

      {/* Searched but no results */}
      {!loading && searched && results.length === 0 && !error && (
        <div className="text-gray-500">No items found matching &quot;{query}&quot; 🙁</div>
      )}

      {/* Results list */}
      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-400">Found {results.length} items</div>
          {results.map((item) => (
            <div
              key={item.item_id}
              className="border rounded p-3 hover:bg-gray-50"
            >
              <div className="font-semibold text-black">{item.item_name}</div>
              <div className="text-sm text-gray-600">
                {item.item_category && <span>📂 {item.item_category}</span>}
                {item.unit && <span className="ml-3">📏 {item.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
