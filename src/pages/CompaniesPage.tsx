import { CoteTable } from "../components/CoteTable.tsx";
import { useMarket } from "../data/DataProvider.tsx";
import { formatLongDate } from "../domain/dates.ts";

export function CompaniesPage() {
  const market = useMarket();
  const delisted = market.companies.filter((c) => c.status === "delisted").length;
  return (
    <div className="companies">
      <header className="page-head">
        <div>
          <h1>Corporations</h1>
          <p>
            Les {market.facts.listed} corporations cotées au {formatLongDate(market.latestDate)}
            {delisted > 0
              ? `, et ${delisted} radiée${delisted > 1 ? "s" : ""} dont KNX garde la mémoire`
              : ""}
            . Triez par n'importe quelle colonne ; les indicateurs en violet sont calculés par KNX.
          </p>
        </div>
      </header>
      <CoteTable
        companies={market.companies}
        variant="full"
        caption="Toutes les corporations suivies par KNX"
      />
    </div>
  );
}
