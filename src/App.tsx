import { createBrowserRouter, RouterProvider } from "react-router";
import { Layout } from "./app/Layout.tsx";
import { DataProvider } from "./data/DataProvider.tsx";
import { CompaniesPage } from "./pages/CompaniesPage.tsx";
import { CompanyPage } from "./pages/CompanyPage.tsx";
import { MarketPage } from "./pages/MarketPage.tsx";
import { MethodPage } from "./pages/MethodPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import { ReportsPage } from "./pages/ReportsPage.tsx";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <MarketPage /> },
      { path: "corporations", element: <CompaniesPage /> },
      { path: "corporations/:slug", element: <CompanyPage /> },
      { path: "releves", element: <ReportsPage /> },
      { path: "methodologie", element: <MethodPage /> },
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
