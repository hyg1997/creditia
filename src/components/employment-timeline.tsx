"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatDate } from "@/lib/formatters";

interface Record {
  patron: string;
  registroPatronal: string;
  entidadFederativa: string;
  fechaAlta: string;
  fechaBaja: string;
  salarioBaseCotizacion: number;
}

interface EmploymentTimelineProps {
  records: Record[];
}

export function EmploymentTimeline({ records }: EmploymentTimelineProps) {
  return (
    <Card>
      <CardContent className="pt-3 sm:pt-4 px-3 sm:px-5">
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-2.5 sm:mb-3">{records.length} registros</p>
        <div className="overflow-x-auto -mx-3 sm:-mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[24px] text-[10px] sm:text-xs">#</TableHead>
                <TableHead className="min-w-[140px] sm:min-w-[180px] text-[10px] sm:text-xs">Patrón</TableHead>
                <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">Entidad</TableHead>
                <TableHead className="text-[10px] sm:text-xs">Alta</TableHead>
                <TableHead className="text-[10px] sm:text-xs">Baja</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Salario</TableHead>
                <TableHead className="text-[10px] sm:text-xs">Ley</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, index) => {
                const year = new Date(record.fechaAlta).getFullYear();
                const isPre97 = year < 1997;
                return (
                  <TableRow key={index}>
                    <TableCell className="text-[10px] sm:text-xs text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-[10px] sm:text-xs leading-tight">{record.patron}</p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground font-mono mt-0.5">
                        {record.registroPatronal}
                      </p>
                    </TableCell>
                    <TableCell className="text-[10px] sm:text-xs hidden sm:table-cell">
                      {record.entidadFederativa}
                    </TableCell>
                    <TableCell className="text-[10px] sm:text-xs whitespace-nowrap font-mono">
                      {formatDate(record.fechaAlta)}
                    </TableCell>
                    <TableCell className="text-[10px] sm:text-xs whitespace-nowrap font-mono">
                      {formatDate(record.fechaBaja)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[10px] sm:text-xs">
                      {formatMXN(record.salarioBaseCotizacion)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isPre97 ? "secondary" : "outline"} className="text-[9px] sm:text-[10px]">
                        {isPre97 ? "73" : "97"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
