"""DCF valuation endpoints (/api/stock/{ticker}/dcf/*)."""

from fastapi import APIRouter, Body, HTTPException

from services.fmp_client import fmp_client

router = APIRouter(prefix="/api/stock")


@router.get("/{ticker}/dcf/data")
def get_dcf_data(ticker: str):
    """Get all data needed for DCF calculation."""
    try:
        symbol = ticker.upper()

        profile_data = fmp_client.get_company_profile(symbol)
        profile = profile_data[0] if profile_data else {}

        income = fmp_client.get_income_statement(symbol, period="annual", limit=5) or []
        cashflow = fmp_client.get_cash_flow_statement(symbol, period="annual", limit=5) or []
        balance = fmp_client.get_balance_sheet(symbol, period="annual", limit=5) or []

        metrics = []
        try:
            metrics = fmp_client.get_key_metrics(symbol, period="annual", limit=5) or []
        except Exception:
            pass

        historical = []
        for i, inc in enumerate(income):
            period = inc.get("calendarYear") or inc.get("date", "")[:4]
            cf = cashflow[i] if i < len(cashflow) else {}
            bs = balance[i] if i < len(balance) else {}

            current_assets = bs.get("totalCurrentAssets") or 0
            current_liabilities = bs.get("totalCurrentLiabilities") or 0
            nwc = current_assets - current_liabilities

            historical.append({
                "period": period,
                "date": inc.get("date"),
                "revenue": inc.get("revenue"),
                "ebit": inc.get("operatingIncome") or inc.get("ebitda"),
                "ebitda": inc.get("ebitda"),
                "netIncome": inc.get("netIncome"),
                "depreciationAndAmortization": cf.get("depreciationAndAmortization") or 0,
                "capitalExpenditure": abs(cf.get("capitalExpenditure") or 0),
                "freeCashFlow": cf.get("freeCashFlow"),
                "operatingCashFlow": cf.get("operatingCashFlow"),
                "totalCash": bs.get("cashAndCashEquivalents") or bs.get("cashAndShortTermInvestments") or 0,
                "totalDebt": bs.get("totalDebt") or (bs.get("longTermDebt", 0) + bs.get("shortTermDebt", 0)),
                "netWorkingCapital": nwc,
                "currentAssets": current_assets,
                "currentLiabilities": current_liabilities,
                "sharesOutstanding": inc.get("weightedAverageShsOut") or profile.get("sharesOutstanding"),
            })

        revenue_growth = None
        if len(income) >= 2:
            rev_now = income[0].get("revenue") or 0
            rev_prev = income[-1].get("revenue") or 0
            if rev_prev and rev_now:
                years = len(income) - 1
                revenue_growth = ((rev_now / rev_prev) ** (1 / years) - 1) * 100

        ebit_margin = None
        if income and income[0].get("revenue") and income[0].get("operatingIncome"):
            ebit_margin = (income[0].get("operatingIncome") / income[0].get("revenue")) * 100

        return {
            "symbol": symbol,
            "companyName": profile.get("companyName", symbol),
            "currentPrice": profile.get("price"),
            "marketCap": profile.get("marketCap"),
            "sharesOutstanding": profile.get("sharesOutstanding"),
            "beta": profile.get("beta"),
            "historical": historical,
            "defaults": {
                "revenueGrowthRate": round(revenue_growth, 2) if revenue_growth else 5.0,
                "ebitMargin": round(ebit_margin, 2) if ebit_margin else 15.0,
                "taxRate": 25.0,
                "discountRate": 10.0,
                "perpetualGrowthRate": 2.5,
                "exitMultiple": 10.0,
            }
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error fetching DCF data for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{ticker}/dcf/calculate")
def calculate_dcf(ticker: str, inputs: dict = Body(...)):
    """Calculate DCF valuation with user-provided assumptions."""
    try:
        symbol = ticker.upper()

        projection_years = inputs.get("projectionYears", 5)
        revenue_growth = inputs.get("revenueGrowthRate", 10) / 100
        ebit_margin = inputs.get("ebitMargin", 20) / 100
        tax_rate = inputs.get("taxRate", 25) / 100
        depreciation_rate = inputs.get("depreciationRate", 3) / 100
        capex_rate = inputs.get("capexRate", 5) / 100
        nwc_rate = inputs.get("nwcRate", 10) / 100
        discount_rate = inputs.get("discountRate", 10) / 100
        terminal_method = inputs.get("terminalMethod", "perpetual")
        perpetual_growth = inputs.get("perpetualGrowthRate", 2.5) / 100
        exit_multiple = inputs.get("exitMultiple", 10)
        shares_outstanding = inputs.get("sharesOutstanding", 1)
        cash = inputs.get("cash", 0)
        debt = inputs.get("debt", 0)
        base_revenue = inputs.get("baseRevenue", 0)

        if not base_revenue or not shares_outstanding:
            raise HTTPException(status_code=400, detail="baseRevenue and sharesOutstanding are required")

        projections = []
        prev_revenue = base_revenue

        for year in range(1, projection_years + 1):
            revenue = prev_revenue * (1 + revenue_growth)
            ebit = revenue * ebit_margin
            taxes = ebit * tax_rate
            nopat = ebit - taxes
            depreciation = revenue * depreciation_rate
            capex = revenue * capex_rate
            delta_nwc = (revenue - prev_revenue) * nwc_rate
            ufcf = nopat + depreciation - capex - delta_nwc
            discount_factor = (1 + discount_rate) ** year
            pv_ufcf = ufcf / discount_factor

            projections.append({
                "year": year,
                "revenue": round(revenue, 0),
                "ebit": round(ebit, 0),
                "taxes": round(taxes, 0),
                "nopat": round(nopat, 0),
                "depreciation": round(depreciation, 0),
                "capex": round(capex, 0),
                "deltaNWC": round(delta_nwc, 0),
                "ufcf": round(ufcf, 0),
                "discountFactor": round(discount_factor, 4),
                "pvUFCF": round(pv_ufcf, 0),
            })

            prev_revenue = revenue

        final_year = projections[-1]
        if terminal_method == "perpetual":
            terminal_fcf = final_year["ufcf"] * (1 + perpetual_growth)
            terminal_value = terminal_fcf / (discount_rate - perpetual_growth)
        else:
            final_ebitda = final_year["ebit"] + final_year["depreciation"]
            terminal_value = final_ebitda * exit_multiple

        pv_terminal = terminal_value / ((1 + discount_rate) ** projection_years)
        sum_pv_fcf = sum(p["pvUFCF"] for p in projections)
        enterprise_value = sum_pv_fcf + pv_terminal
        equity_value = enterprise_value + cash - debt
        intrinsic_value_per_share = equity_value / shares_outstanding if shares_outstanding else 0

        current_price = inputs.get("currentPrice", 0)
        upside = ((intrinsic_value_per_share / current_price) - 1) * 100 if current_price else None

        return {
            "symbol": symbol,
            "projections": projections,
            "terminalValue": round(terminal_value, 0),
            "pvTerminalValue": round(pv_terminal, 0),
            "sumPVCashFlows": round(sum_pv_fcf, 0),
            "enterpriseValue": round(enterprise_value, 0),
            "cash": round(cash, 0),
            "debt": round(debt, 0),
            "equityValue": round(equity_value, 0),
            "sharesOutstanding": shares_outstanding,
            "intrinsicValuePerShare": round(intrinsic_value_per_share, 2),
            "currentPrice": current_price,
            "upside": round(upside, 2) if upside is not None else None,
            "terminalMethod": terminal_method,
            "assumptions": {
                "projectionYears": projection_years,
                "revenueGrowthRate": revenue_growth * 100,
                "ebitMargin": ebit_margin * 100,
                "taxRate": tax_rate * 100,
                "depreciationRate": depreciation_rate * 100,
                "capexRate": capex_rate * 100,
                "nwcRate": nwc_rate * 100,
                "discountRate": discount_rate * 100,
                "perpetualGrowthRate": perpetual_growth * 100 if terminal_method == "perpetual" else None,
                "exitMultiple": exit_multiple if terminal_method == "multiple" else None,
            }
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[ERROR] Error calculating DCF for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
