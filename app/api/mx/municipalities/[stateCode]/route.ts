// app/api/mx/municipalities/[stateCode]/route.ts

import { NextResponse } from 'next/server'
import { getStateNameByCode, isValidStateCode } from '@/lib/mx-locations'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type MunicipalityItem = {
  code: string
  name: string
}

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getValueCaseInsensitive(
  obj: PlainObject,
  keys: string[]
): unknown {
  const lowerMap = new Map<string, unknown>()

  for (const [key, value] of Object.entries(obj)) {
    lowerMap.set(key.toLowerCase(), value)
  }

  for (const key of keys) {
    const found = lowerMap.get(key.toLowerCase())
    if (found !== undefined && found !== null && found !== '') {
      return found
    }
  }

  return undefined
}

function extractMunicipalityFromObject(obj: PlainObject): MunicipalityItem | null {
  const source = isPlainObject(obj.properties) ? obj.properties : obj

  const rawCode =
    getValueCaseInsensitive(source, [
      'cve_mun',
      'cve_mpio',
      'cve_municipio',
      'clave',
      'id',
    ]) ??
    (() => {
      const cvegeo = getValueCaseInsensitive(source, ['cvegeo', 'cve_geo'])
      if (typeof cvegeo === 'string' && cvegeo.length >= 5) {
        return cvegeo.slice(2, 5)
      }
      return undefined
    })()

  const rawName = getValueCaseInsensitive(source, [
    'nomgeo',
    'nom_mun',
    'nom_mpio',
    'nom_municipio',
    'nombre',
    'name',
  ])

  const code = String(rawCode ?? '').trim()
  const name = String(rawName ?? '').trim()

  if (!code || !name) return null

  return { code, name }
}

function collectMunicipalities(node: unknown, acc: MunicipalityItem[] = []) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectMunicipalities(item, acc)
    }
    return acc
  }

  if (!isPlainObject(node)) {
    return acc
  }

  const extracted = extractMunicipalityFromObject(node)
  if (extracted) {
    acc.push(extracted)
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value) || isPlainObject(value)) {
      collectMunicipalities(value, acc)
    }
  }

  return acc
}

function normalizeMunicipalities(payload: unknown) {
  const collected = collectMunicipalities(payload)

  const deduped = collected.filter(
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
      console.error('[mx:municipalities] INEGI bad response', {
        stateCode: normalizedCode,
        status: response.status,
        body: text,
      })

      return NextResponse.json(
        { error: 'No se pudieron cargar los municipios' },
        { status: 502 }
      )
    }

    const payload = await response.json()
    const municipalities = normalizeMunicipalities(payload)

    if (!municipalities.length) {
      console.error('[mx:municipalities] empty result', {
        stateCode: normalizedCode,
        stateName,
        payload,
      })
    }

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