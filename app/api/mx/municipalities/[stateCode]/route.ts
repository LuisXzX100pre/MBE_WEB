// app/api/mx/municipalities/[stateCode]/route.ts

import { NextResponse } from 'next/server'
import { getStateNameByCode, isValidStateCode } from '@/lib/mx-locations'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RawMunicipality = {
  cvegeo?: string
  cve_ent?: string
  cve_mun?: string | number
  nomgeo?: string
  nombre?: string
  nom_mun?: string
}

type IngegiPayload =
  | RawMunicipality[]
  | {
      datos?: RawMunicipality[]
      data?: RawMunicipality[]
      results?: RawMunicipality[]
      municipios?: RawMunicipality[]
    }

function toArray(payload: IngegiPayload): RawMunicipality[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.datos)) return payload.datos
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.municipios)) return payload.municipios
  return []
}

function normalizeMunicipalities(payload: IngegiPayload) {
  const candidates = toArray(payload)

  const normalized = candidates
    .map((item) => {
      const code =
        String(
          item.cve_mun ??
            (item.cvegeo && String(item.cvegeo).length >= 5
              ? String(item.cvegeo).slice(2)
              : '')
        ).trim()

      const name = String(
        item.nomgeo ?? item.nom_mun ?? item.nombre ?? ''
      ).trim()

      return { code, name }
    })
    .filter((item) => item.code && item.name)

  const deduped = normalized.filter(
    (item, index, arr) =>
      index === arr.findIndex((x) => x.code === item.code && x.name === item.name)
  )

  return deduped.sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ stateCode: string }> }
) {
  try {
    const { stateCode } = await context.params
    const normalizedCode = String(stateCode || '').trim().padStart(2, '0')

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
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('[mx:municipalities] inegi bad response', {
        stateCode: normalizedCode,
        status: response.status,
        body: text,
      })

      return NextResponse.json(
        { error: 'No se pudieron cargar los municipios' },
        { status: 502 }
      )
    }

    const payload = (await response.json()) as IngegiPayload
    const municipalities = normalizeMunicipalities(payload)

    console.log('[mx:municipalities] success', {
      stateCode: normalizedCode,
      stateName,
      count: municipalities.length,
    })

    return NextResponse.json(
      {
        stateCode: normalizedCode,
        stateName,
        municipalities,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    console.error('[mx:municipalities] error', error)

    return NextResponse.json(
      { error: 'Error al cargar municipios' },
      { status: 500 }
    )
  }
}