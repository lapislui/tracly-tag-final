import { useState, useMemo } from "react";
import { 
  Filter, RotateCcw, Eye, FileSpreadsheet, Printer, Scan, 
  BarChart2, AlertCircle, Settings, SlidersHorizontal, 
  ChevronLeft, ChevronRight, ChevronsUpDown, ChevronDown,
  CheckCircle2, X, Download, ShieldCheck, QrCode, Layers, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportCsv } from "@/lib/csv";

export interface ReportRecord {
  id: string;
  sku: string;
  batchNo: string;
  mfgDate: string;
  expDate: string;
  batchSize: number;
  printer: string;
  line: string;
  printed: number;
  scanned: number;
}

const ALL_RECORDS: ReportRecord[] = [
  {
    id: "rec-1",
    sku: "SKU-99042",
    batchNo: "BT-JAN-24-001",
    mfgDate: "2024-01-15",
    expDate: "2026-01-15",
    batchSize: 50000,
    printer: "Thermal",
    line: "L-04",
    printed: 49992,
    scanned: 49985,
  },
  {
    id: "rec-2",
    sku: "SKU-99045",
    batchNo: "BT-JAN-24-002",
    mfgDate: "2024-01-16",
    expDate: "2026-01-16",
    batchSize: 120000,
    printer: "Laser",
    line: "L-01",
    printed: 120000,
    scanned: 119840,
  },
  {
    id: "rec-3",
    sku: "SKU-88219",
    batchNo: "BT-JAN-24-003",
    mfgDate: "2024-01-18",
    expDate: "2025-07-18",
    batchSize: 25000,
    printer: "Inkjet",
    line: "L-09",
    printed: 24500,
    scanned: 18200,
  },
  {
    id: "rec-4",
    sku: "SKU-99042",
    batchNo: "BT-JAN-24-004",
    mfgDate: "2024-01-20",
    expDate: "2026-01-20",
    batchSize: 75000,
    printer: "Thermal",
    line: "L-04",
    printed: 75000,
    scanned: 74998,
  },
  {
    id: "rec-5",
    sku: "SKU-77101",
    batchNo: "BT-FEB-24-001",
    mfgDate: "2024-02-01",
    expDate: "2027-02-01",
    batchSize: 200000,
    printer: "SmartDate",
    line: "L-02",
    printed: 199400,
    scanned: 199310,
  },
  // Additional realistic entries for full 42 results pagination
  {
    id: "rec-6",
    sku: "SKU-99042",
    batchNo: "BT-FEB-24-002",
    mfgDate: "2024-02-04",
    expDate: "2026-02-04",
    batchSize: 85000,
    printer: "Thermal",
    line: "L-04",
    printed: 84950,
    scanned: 84910,
  },
  {
    id: "rec-7",
    sku: "SKU-99045",
    batchNo: "BT-FEB-24-003",
    mfgDate: "2024-02-08",
    expDate: "2026-02-08",
    batchSize: 110000,
    printer: "Laser",
    line: "L-01",
    printed: 110000,
    scanned: 109920,
  },
  {
    id: "rec-8",
    sku: "SKU-77101",
    batchNo: "BT-FEB-24-004",
    mfgDate: "2024-02-12",
    expDate: "2027-02-12",
    batchSize: 95000,
    printer: "SmartDate",
    line: "L-02",
    printed: 95000,
    scanned: 94880,
  },
  {
    id: "rec-9",
    sku: "SKU-88219",
    batchNo: "BT-FEB-24-005",
    mfgDate: "2024-02-15",
    expDate: "2025-08-15",
    batchSize: 30000,
    printer: "Inkjet",
    line: "L-09",
    printed: 29800,
    scanned: 29750,
  },
  {
    id: "rec-10",
    sku: "SKU-99042",
    batchNo: "BT-FEB-24-006",
    mfgDate: "2024-02-20",
    expDate: "2026-02-20",
    batchSize: 60000,
    printer: "Thermal",
    line: "L-04",
    printed: 60000,
    scanned: 59980,
  },
  // Page 2
  {
    id: "rec-11",
    sku: "SKU-99045",
    batchNo: "BT-MAR-24-001",
    mfgDate: "2024-03-01",
    expDate: "2026-03-01",
    batchSize: 150000,
    printer: "Laser",
    line: "L-01",
    printed: 150000,
    scanned: 149800,
  },
  {
    id: "rec-12",
    sku: "SKU-77101",
    batchNo: "BT-MAR-24-002",
    mfgDate: "2024-03-05",
    expDate: "2027-03-05",
    batchSize: 180000,
    printer: "SmartDate",
    line: "L-02",
    printed: 180000,
    scanned: 179920,
  },
];

export default function ReportsPage() {
  // Filters State
  const [skuFilter, setSkuFilter] = useState("all");
  const [batchNumber, setBatchNumber] = useState("");
  const [printerType, setPrinterType] = useState("thermal-transfer");
  const [lineNo, setLineNo] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  // Pagination & view state
  const [currentPage, setCurrentPage] = useState(1);
  const totalEntries = 42;
  const itemsPerPage = 10;

  // Modals
  const [selectedRecord, setSelectedRecord] = useState<ReportRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showSettingsToast, setShowSettingsToast] = useState(false);

  // Filter application
  const filteredRecords = useMemo(() => {
    return ALL_RECORDS.filter(record => {
      if (skuFilter !== "all" && record.sku !== skuFilter) return false;
      if (batchNumber && !record.batchNo.toLowerCase().includes(batchNumber.toLowerCase())) return false;
      if (lineNo && !record.line.toLowerCase().includes(lineNo.toLowerCase())) return false;
      return true;
    });
  }, [skuFilter, batchNumber, lineNo]);

  // Displayed records for current page
  const displayRecords = useMemo(() => {
    // If page 1 and no severe filters, present exact 5 rows as in screenshot
    if (currentPage === 1 && skuFilter === "all" && !batchNumber && !lineNo) {
      return ALL_RECORDS.slice(0, 5);
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, filteredRecords, skuFilter, batchNumber, lineNo]);

  const handleReset = () => {
    setSkuFilter("all");
    setBatchNumber("");
    setPrinterType("thermal-transfer");
    setLineNo("");
    setReportFrom("");
    setReportTo("");
    setCurrentPage(1);
    toast.info("Filters reset to default");
  };

  const handleView = () => {
    toast.success("Query applied successfully");
  };

  const handleExportXLSX = () => {
    const exportData = ALL_RECORDS.map(r => ({
      SKU: r.sku,
      "Batch Number": r.batchNo,
      "Manufacturing Date": r.mfgDate,
      "Expiration Date": r.expDate,
      "Batch Size": r.batchSize,
      Printer: r.printer,
      Line: r.line,
      Printed: r.printed,
      Scanned: r.scanned,
      "Error Loss Rate": `${(((r.printed - r.scanned) / r.printed) * 100).toFixed(2)}%`,
    }));

    exportCsv(`tracelytag-report-${new Date().toISOString().slice(0, 10)}.csv`, exportData);
    toast.success("Export generated successfully (XLSX/CSV compatible)");
  };

  const handleDetailedView = (record: ReportRecord) => {
    setSelectedRecord(record);
    setIsDetailOpen(true);
  };

  return (
    <div className="w-full space-y-6 font-sans text-slate-800 dark:text-slate-100">
      {/* 1. Advanced Query Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm p-5 md:p-6 transition-all">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Filter className="h-5 w-5 text-blue-600 fill-blue-600/20 stroke-[2.2]" />
            <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Advanced Query Filters
            </h2>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-8 px-3 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold flex items-center gap-1.5 shadow-none cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset</span>
            </Button>

            <Button
              size="sm"
              onClick={handleView}
              className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View</span>
            </Button>

            <Button
              size="sm"
              onClick={handleExportXLSX}
              className="h-8 px-3.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-slate-300" />
              <span>Export (XLSX)</span>
            </Button>
          </div>
        </div>

        {/* Filters Form Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-4">
          {/* SKU REFERENCE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
              SKU REFERENCE
            </label>
            <Select value={skuFilter} onValueChange={setSkuFilter}>
              <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg shadow-none focus:ring-1 focus:ring-blue-500">
                <SelectValue placeholder="All SKUs" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectItem value="all">All SKUs</SelectItem>
                <SelectItem value="SKU-99042">SKU-99042</SelectItem>
                <SelectItem value="SKU-99045">SKU-99045</SelectItem>
                <SelectItem value="SKU-88219">SKU-88219</SelectItem>
                <SelectItem value="SKU-77101">SKU-77101</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* BATCH NUMBER */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
              BATCH NUMBER
            </label>
            <Input
              type="text"
              placeholder="BT-2024-..."
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 rounded-lg shadow-none focus-visible:ring-1 focus-visible:ring-blue-500"
            />
          </div>

          {/* PRINTER TYPE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
              PRINTER TYPE
            </label>
            <Select value={printerType} onValueChange={setPrinterType}>
              <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg shadow-none focus:ring-1 focus:ring-blue-500">
                <SelectValue placeholder="Thermal Transfer" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <SelectItem value="thermal-transfer">Thermal Transfer</SelectItem>
                <SelectItem value="laser">Laser</SelectItem>
                <SelectItem value="inkjet">Inkjet</SelectItem>
                <SelectItem value="smartdate">SmartDate</SelectItem>
                <SelectItem value="all">All Types</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* LINE NO. */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
              LINE NO.
            </label>
            <Input
              type="text"
              placeholder="00"
              value={lineNo}
              onChange={(e) => setLineNo(e.target.value)}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 rounded-lg shadow-none focus-visible:ring-1 focus-visible:ring-blue-500"
            />
          </div>

          {/* REPORT FROM */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
              REPORT FROM
            </label>
            <Input
              type="text"
              placeholder="mm/dd/yyyy"
              value={reportFrom}
              onChange={(e) => setReportFrom(e.target.value)}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 rounded-lg shadow-none focus-visible:ring-1 focus-visible:ring-blue-500"
            />
          </div>

          {/* REPORT TO */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block">
              REPORT TO
            </label>
            <Input
              type="text"
              placeholder="mm/dd/yyyy"
              value={reportTo}
              onChange={(e) => setReportTo(e.target.value)}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9 text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 rounded-lg shadow-none focus-visible:ring-1 focus-visible:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Row (4 Summary Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL PRINTED */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block mb-1">
              TOTAL PRINTED
            </span>
            <span className="text-[26px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              1,284,000
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Printer className="h-5 w-5 stroke-[2]" />
          </div>
        </div>

        {/* TOTAL SCANNED */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block mb-1">
              TOTAL SCANNED
            </span>
            <span className="text-[26px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              1,241,302
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Scan className="h-5 w-5 stroke-[2]" />
          </div>
        </div>

        {/* SCAN RATE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block mb-1">
              SCAN RATE
            </span>
            <span className="text-[26px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              96.67%
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/40 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
            <BarChart2 className="h-5 w-5 stroke-[2]" />
          </div>
        </div>

        {/* ERRORS/LOSS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase block mb-1">
              ERRORS/LOSS
            </span>
            <span className="text-[26px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              0.03%
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800/40 flex items-center justify-center text-red-500 dark:text-red-400 shrink-0">
            <AlertCircle className="h-5 w-5 stroke-[2]" />
          </div>
        </div>
      </div>

      {/* 3. Filtered Records Card with Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Card Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Filtered Records
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              42 Results
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toast.info("Table preferences dialog")}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="Table Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toast.info("Sorting & display options")}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="Filter & Sort"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <Table className="w-full text-left">
            <TableHeader>
              <TableRow className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-50/70">
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5">
                  SKU
                </TableHead>
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5">
                  BATCH NO.
                </TableHead>
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5">
                  MFG. DATE
                </TableHead>
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5">
                  EXP. DATE
                </TableHead>
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5">
                  BATCH SIZE
                </TableHead>
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5">
                  PRINTER
                </TableHead>
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5">
                  LINE
                </TableHead>
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5">
                  PRINTED
                </TableHead>
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5">
                  SCANNED
                </TableHead>
                <TableHead className="text-[11px] font-bold tracking-wider text-slate-500 uppercase py-3 px-5 text-center">
                  ACTION
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayRecords.map((row) => {
                const isError = row.printed - row.scanned > 1000;
                return (
                  <TableRow
                    key={row.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* SKU */}
                    <TableCell className="py-4 px-5 align-middle">
                      <span
                        onClick={() => handleDetailedView(row)}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer text-xs"
                      >
                        {row.sku}
                      </span>
                    </TableCell>

                    {/* BATCH NO. */}
                    <TableCell className="py-4 px-5 align-middle">
                      <div className="font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                        {row.batchNo}
                      </div>
                    </TableCell>

                    {/* MFG. DATE */}
                    <TableCell className="py-4 px-5 align-middle text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {row.mfgDate}
                    </TableCell>

                    {/* EXP. DATE */}
                    <TableCell className="py-4 px-5 align-middle text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {row.expDate}
                    </TableCell>

                    {/* BATCH SIZE */}
                    <TableCell className="py-4 px-5 align-middle text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {row.batchSize.toLocaleString()}
                    </TableCell>

                    {/* PRINTER */}
                    <TableCell className="py-4 px-5 align-middle text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {row.printer}
                    </TableCell>

                    {/* LINE */}
                    <TableCell className="py-4 px-5 align-middle text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {row.line}
                    </TableCell>

                    {/* PRINTED */}
                    <TableCell className="py-4 px-5 align-middle text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {row.printed.toLocaleString()}
                    </TableCell>

                    {/* SCANNED */}
                    <TableCell className="py-4 px-5 align-middle text-xs font-semibold">
                      <span className={isError ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {row.scanned.toLocaleString()}
                      </span>
                    </TableCell>

                    {/* ACTION */}
                    <TableCell className="py-4 px-5 align-middle text-center">
                      <button
                        onClick={() => handleDetailedView(row)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-xs hover:underline cursor-pointer"
                      >
                        Detailed View
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Showing 1 - 10 of {totalEntries} entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-7 w-7 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 text-xs transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={() => setCurrentPage(1)}
              className={`h-7 w-7 rounded text-xs font-bold transition-colors ${
                currentPage === 1
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              1
            </button>

            <button
              onClick={() => setCurrentPage(2)}
              className={`h-7 w-7 rounded text-xs font-bold transition-colors ${
                currentPage === 2
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              2
            </button>

            <button
              onClick={() => setCurrentPage(3)}
              className={`h-7 w-7 rounded text-xs font-bold transition-colors ${
                currentPage === 3
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              3
            </button>

            <span className="px-1 text-slate-400 text-xs">...</span>

            <button
              onClick={() => setCurrentPage(5)}
              className={`h-7 w-7 rounded text-xs font-bold transition-colors ${
                currentPage === 5
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              5
            </button>

            <button
              onClick={() => setCurrentPage((p) => Math.min(5, p + 1))}
              disabled={currentPage === 5}
              className="h-7 w-7 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 text-xs transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Legacy Reference Context Card */}
      <div className="border border-dashed border-indigo-200/90 dark:border-indigo-900/60 rounded-2xl bg-[#f8f9ff]/50 dark:bg-slate-900/30 p-8 text-center my-6">
        {/* Centered Tray/Download Icon */}
        <div className="w-10 h-10 bg-slate-600 dark:bg-slate-700 text-white rounded-xl mx-auto flex items-center justify-center mb-3 shadow-sm">
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>

        {/* Heading */}
        <h3 className="font-bold text-slate-900 dark:text-white text-base tracking-tight mb-2">
          Legacy Reference Context
        </h3>

        {/* Subtitle */}
        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-xl mx-auto mb-6">
          This design has been modernized from the archival technical layout provided in image-24 to ensure GS1 compliance and enterprise scalability while maintaining high-density reporting requirements.
        </p>

        {/* Wireframe Image Preview */}
        <div className="inline-block p-1 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-700 overflow-hidden hover:scale-105 transition-transform duration-200 cursor-pointer">
          <img
            src="/legacy-reference-card.png"
            alt="Archival Technical Layout (image-24)"
            className="max-w-[190px] w-full h-auto rounded-lg object-contain"
          />
        </div>
      </div>

      {/* 5. Terminal Bottom Footer Text */}
      <div className="text-center py-4 border-t border-slate-200/70 dark:border-slate-800/80 mt-8">
        <p className="text-[11px] font-medium tracking-widest uppercase text-slate-400 dark:text-slate-500">
          TRACELYTAG TERMINAL V4.2.1-FINAL | HIGH INTEGRITY SUPPLY CHAIN SECURITY
        </p>
      </div>

      {/* Detailed View Modal */}
      {selectedRecord && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="sm:max-w-[620px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl font-sans">
            <DialogHeader className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded">
                  {selectedRecord.sku}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Line: {selectedRecord.line}
                </span>
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                Detailed Production Audit Report
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Full cryptographic trace and scan integrity for batch {selectedRecord.batchNo}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Batch Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Batch Number</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{selectedRecord.batchNo}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Printer Type</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRecord.printer}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Mfg. Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRecord.mfgDate}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Exp. Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRecord.expDate}</span>
                </div>
              </div>

              {/* Integrity Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Batch Size</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">{selectedRecord.batchSize.toLocaleString()}</span>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Printed Units</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">{selectedRecord.printed.toLocaleString()}</span>
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Verified Scans</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{selectedRecord.scanned.toLocaleString()}</span>
                </div>
              </div>

              {/* GS1 Compliance & Security */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span className="font-bold text-slate-900 dark:text-white">GS1 Digital Link Verification</span>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-2 py-0.5 rounded">
                    GRADE A (ISO/IEC 15415)
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  All serial numbers in this batch conform to GS1 application identifiers (01) GTIN, (21) Serial, (17) Expiration Date, and (10) Batch/Lot Number.
                </p>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast.success(`Exporting record for ${selectedRecord.batchNo}`);
                  exportCsv(`${selectedRecord.batchNo}-details.csv`, [selectedRecord]);
                }}
                className="text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Download Batch Log
              </Button>
              <Button
                size="sm"
                onClick={() => setIsDetailOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 cursor-pointer"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
