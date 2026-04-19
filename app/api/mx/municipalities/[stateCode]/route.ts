// app/api/mx/municipalities/[stateCode]/route.ts

import { NextResponse } from 'next/server'
import { getStateNameByCode, isValidStateCode } from '@/lib/mx-locations'

type RawMunicipality = {
  cvegeo?: string
  cve_ent?: string
  cve_mun?: string
  nomgeo?: string
  nombre?: string
  nom_mun?: string
}

function normalizeMunicipalities(payload: unknown) {
  const candidates: RawMunicipality[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
      ? ((payload as { data?: RawMunicipality[] }).data ?? [])
      : Array.isArray((payload as { results?: unknown[] })?.results)
        ? ((payload as { results?: RawMunicipality[] }).results ?? [])
        : Array.isArray((payload as { municipios?: unknown[] })?.municipios)
          ? ((payload as { municipios?: RawMunicipality[] }).municipios ?? [])
          : []

  return candidates
    .map((item) => {
      const code =
        item.cve_mun ||
        (item.cvegeo && item.cvegeo.length >= 5 ? item.cvegeo.slice(2) : '')

      const name = item.nomgeo || item.nombre || item.nom_mun || ''

      return {
        code: String(code || '').trim(),
        name: String(name || '').trim(),
      }
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

    const payload = await response.json()
    const municipalities = normalizeMunicipalities(payload)

    if (!municipalities.length) {
      return NextResponse.json(
        {
          stateCode: normalizedCode,
          stateName,
          municipalities: [],
        },
        {
          headers: {
            'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
          },
        }
      )
    }

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