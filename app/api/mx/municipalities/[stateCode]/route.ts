// app/api/mx/municipalities/[stateCode]/route.ts

import { NextResponse } from 'next/server'
import { getStateNameByCode, isValidStateCode } from '@/lib/mx-locations'

type RawMunicipality = {
  cvegeo?: string
  cve_ent?: string
  cve_mun?: string
  cve_agem?: string
  nomgeo?: string
  nombre?: string
  nom_mun?: string
  nom_agem?: string
}

type IngegiPayload =
  | RawMunicipality[]
  | {
      datos?: RawMunicipality[]
      data?: RawMunicipality[]
      results?: RawMunicipality[]
      municipios?: RawMunicipality[]
    }

function normalizeMunicipalities(payload: IngegiPayload) {
  const candidates: RawMunicipality[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.datos)
      ? payload.datos
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload?.municipios)
            ? payload.municipios
            : []

  return candidates
    .map((item) => {
      const code =
        String(
          item.cve_mun ||
            item.cve_agem ||
            (item.cvegeo && item.cvegeo.length >= 5 ? item.cvegeo.slice(2) : '')
        ).trim()

      const name = String(
        item.nomgeo ||
          item.nom_mun ||
          item.nom_agem ||
          item.nombre ||
          ''
      ).trim()

      return { code, name }
    })
    .filter((item) => item.code && item.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ stateCode: string }> }
) {
  try {
    const { stateCode } = await context.params
    const normalizedCode = String(stateCode || '').trim()

    if (!isValidStateCode(normalizedCode)) {
      return NextResponse.json(
        { error: 'Estado inválido' },
        { status: 400 }
      )
    }

    const stateName = getStateNameByCode(normalizedCode)

    const response = await fetch(
      `https://gaia.inegi.org.mx/wscatgeo/v2/mgem/${normalizedCode}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'force-cache',
        next: { revalidate: 60 * 60 * 24 * 7 },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'No se pudieron cargar los municipios' },
        { status: 502 }
      )
    }

    const payload = (await response.json()) as IngegiPayload
    const municipalities = normalizeMunicipalities(payload)

    return NextResponse.json(
      {
        stateCode: normalizedCode,
        stateName,
        municipalities,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
        },
      }
    )
  } catch (error) {
    console.error('[mx:municipalities]', error)

    return NextResponse.json(
      { error: 'Error al cargar municipios' },
      { status: 500 }
    )
  }
}