import { createBrowserRouter, RouterProvider } from "react-router";
import { Layout } from "./app/Layout.tsx";
import { DataProvider } from "./data/DataProvider.tsx";
import { AccountsAdminPage } from "./pages/AccountsAdminPage.tsx";
import { BourseAdminPage } from "./pages/BourseAdminPage.tsx";
import { BoursePage } from "./pages/BoursePage.tsx";
import { CompaniesPage } from "./pages/CompaniesPage.tsx";
import { CompanyPage } from "./pages/CompanyPage.tsx";
import { ConsortiumsPage } from "./pages/ConsortiumsPage.tsx";
import { InvestorPage } from "./pages/InvestorPage.tsx";
import { MarketPage } from "./pages/MarketPage.tsx";
import { SessionAdminPage } from "./pages/SessionAdminPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import { ReportsPage } from "./pages/ReportsPage.tsx";
import { SectorsPage } from "./pages/SectorsPage.tsx";
import { StudiesPage } from "./pages/StudiesPage.tsx";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <MarketPage /> },
      { path: "corporations", element: <CompaniesPage /> },
      { path: "corporations/:slug", element: <CompanyPage /> },
      { path: "secteurs", element: <SectorsPage /> },
      { path: "consortiums", element: <ConsortiumsPage /> },
      { path: "etudes", element: <StudiesPage /> },
      { path: "bourse", element: <BoursePage /> },
      { path: "bourse/reglages", element: <BourseAdminPage /> },
      { path: "bourse/comptes", element: <AccountsAdminPage /> },
      { path: "bourse/seance", element: <SessionAdminPage /> },
      { path: "compte", element: <InvestorPage /> },
      { path: "releves", element: <ReportsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return (
    <DataProvider>
      <RouterProvider router={router} />
    </DataProvider>
  );
}
