import { CoteTable } from "../components/CoteTable.tsx";
import { ImperialDate } from "../components/figures.tsx";
import { useMarket } from "../data/DataProvider.tsx";

export function CompaniesPage() {
  const market = useMarket();
  const delisted = market.companies.filter((c) => c.status === "delisted").length;
  return (
    <div className="companies">
      <header className="page-head">
        <div>
          <h1>Corporations</h1>
          <p>
            Les {market.facts.listed} corporations cotées au{" "}
            <ImperialDate date={market.latestDate} />
            {delisted > 0
              ? `, et ${delisted} fermée${delisted > 1 ? "s" : ""} dont KNX garde la mémoire`
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
