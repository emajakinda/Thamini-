/*
 * Static reference list of NSE-listed companies used for autocomplete, ticker
 * resolution, and automatic sector pinning. Market data is never taken from
 * this file; all prices and figures come from live web search.
 */

export const SECTORS = [
  "Banking",
  "Telco",
  "Energy",
  "Insurance",
  "Manufacturing & Allied",
  "Commercial & Services",
  "Agricultural",
  "Investment",
  "Construction & Allied",
  "Automobiles & Accessories",
  "Real Estate & REITs",
];

export const NSE_COMPANIES = [
  { name: "Safaricom", ticker: "SCOM", sector: "Telco" },
  { name: "Equity Group Holdings", ticker: "EQTY", sector: "Banking" },
  { name: "KCB Group", ticker: "KCB", sector: "Banking" },
  { name: "Co-operative Bank of Kenya", ticker: "COOP", sector: "Banking" },
  { name: "NCBA Group", ticker: "NCBA", sector: "Banking" },
  { name: "Absa Bank Kenya", ticker: "ABSA", sector: "Banking" },
  { name: "Standard Chartered Bank Kenya", ticker: "SCBK", sector: "Banking" },
  { name: "Stanbic Holdings", ticker: "SBIC", sector: "Banking" },
  { name: "I&M Group", ticker: "IMH", sector: "Banking" },
  { name: "Diamond Trust Bank", ticker: "DTK", sector: "Banking" },
  { name: "HF Group", ticker: "HFCK", sector: "Banking" },
  { name: "BK Group", ticker: "BKG", sector: "Banking" },
  { name: "KenGen", ticker: "KEGN", sector: "Energy" },
  { name: "Kenya Power & Lighting", ticker: "KPLC", sector: "Energy" },
  { name: "TotalEnergies Marketing Kenya", ticker: "TOTL", sector: "Energy" },
  { name: "Umeme", ticker: "UMME", sector: "Energy" },
  { name: "Britam Holdings", ticker: "BRIT", sector: "Insurance" },
  { name: "Jubilee Holdings", ticker: "JUB", sector: "Insurance" },
  { name: "CIC Insurance Group", ticker: "CIC", sector: "Insurance" },
  { name: "Kenya Re-Insurance", ticker: "KNRE", sector: "Insurance" },
  { name: "Liberty Kenya Holdings", ticker: "LBTY", sector: "Insurance" },
  { name: "Sanlam Kenya", ticker: "SLAM", sector: "Insurance" },
  { name: "East African Breweries", ticker: "EABL", sector: "Manufacturing & Allied" },
  { name: "BAT Kenya", ticker: "BAT", sector: "Manufacturing & Allied" },
  { name: "Bamburi Cement", ticker: "BAMB", sector: "Manufacturing & Allied" },
  { name: "Carbacid Investments", ticker: "CARB", sector: "Manufacturing & Allied" },
  { name: "BOC Kenya", ticker: "BOC", sector: "Manufacturing & Allied" },
  { name: "Unga Group", ticker: "UNGA", sector: "Manufacturing & Allied" },
  { name: "Flame Tree Group", ticker: "FTGH", sector: "Manufacturing & Allied" },
  { name: "Kenya Airways", ticker: "KQ", sector: "Commercial & Services" },
  { name: "Nation Media Group", ticker: "NMG", sector: "Commercial & Services" },
  { name: "Standard Group", ticker: "SGL", sector: "Commercial & Services" },
  { name: "TPS Eastern Africa (Serena)", ticker: "TPSE", sector: "Commercial & Services" },
  { name: "WPP Scangroup", ticker: "SCAN", sector: "Commercial & Services" },
  { name: "Longhorn Publishers", ticker: "LKL", sector: "Commercial & Services" },
  { name: "Nairobi Securities Exchange", ticker: "NSE", sector: "Commercial & Services" },
  { name: "Eveready East Africa", ticker: "EVRD", sector: "Commercial & Services" },
  { name: "Sameer Africa", ticker: "SMER", sector: "Commercial & Services" },
  { name: "Sasini", ticker: "SASN", sector: "Agricultural" },
  { name: "Kakuzi", ticker: "KUKZ", sector: "Agricultural" },
  { name: "Williamson Tea Kenya", ticker: "WTK", sector: "Agricultural" },
  { name: "Kapchorua Tea", ticker: "KAPC", sector: "Agricultural" },
  { name: "Limuru Tea", ticker: "LIMT", sector: "Agricultural" },
  { name: "Eaagads", ticker: "EGAD", sector: "Agricultural" },
  { name: "Centum Investment", ticker: "CTUM", sector: "Investment" },
  { name: "Olympia Capital Holdings", ticker: "OCH", sector: "Investment" },
  { name: "TransCentury", ticker: "TCL", sector: "Investment" },
  { name: "Home Afrika", ticker: "HAFR", sector: "Real Estate & REITs" },
  { name: "ILAM Fahari I-REIT", ticker: "FAHR", sector: "Real Estate & REITs" },
  { name: "Crown Paints Kenya", ticker: "CRWN", sector: "Construction & Allied" },
  { name: "East African Cables", ticker: "CABL", sector: "Construction & Allied" },
  { name: "East African Portland Cement", ticker: "PORT", sector: "Construction & Allied" },
  { name: "Car & General", ticker: "CGEN", sector: "Automobiles & Accessories" },
];

/* Resolve free text to a known NSE company by ticker or name match. */
export function resolveCompany(input) {
  const q = (input || "").trim().toLowerCase();
  if (!q) return null;
  const byTicker = NSE_COMPANIES.find((c) => c.ticker.toLowerCase() === q);
  if (byTicker) return byTicker;
  const byName = NSE_COMPANIES.find((c) => c.name.toLowerCase() === q);
  if (byName) return byName;
  const partial = NSE_COMPANIES.find(
    (c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())
  );
  return partial || null;
}
