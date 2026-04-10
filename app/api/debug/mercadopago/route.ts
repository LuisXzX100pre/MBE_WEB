// Endpoint temporal para diagnosticar problemas con Mercado Pago
// ELIMINAR EN PRODUCCION
import { NextResponse } from 'next/server'

export async function GET() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  
  // Info del token (sin exponer el token completo)
  const tokenInfo = accessToken ? {
    present: true,
    length: accessToken.length,
    prefix: accessToken.substring(0, 20) + '...',
    suffix: '...' + accessToken.substring(accessToken.length - 10),
    type: accessToken.startsWith('TEST-') ? 'TEST' : 
          accessToken.startsWith('APP_USR-') ? 'APP_USR' : 'UNKNOWN'
  } : { present: false }

  // Probar conexion a MP
  let mpTest = null
  if (accessToken) {
    try {
      // Intentar obtener info del usuario (endpoint simple para verificar token)
      const response = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      
      const responseText = await response.text()
      let responseData = null
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = responseText
      }

      mpTest = {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        data: response.ok ? {
          id: responseData?.id,
          email: responseData?.email,
          site_id: responseData?.site_id,
          country_id: responseData?.country_id,
        } : responseData
      }
    } catch (error) {
      mpTest = {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
    },
    config: {
      NEXT_PUBLIC_APP_URL: appUrl,
      token: tokenInfo,
    },
    mercadoPagoTest: mpTest,
    hint: mpTest?.status === 401 ? 'Token invalido o expirado' :
          mpTest?.status === 403 ? 'Token no tiene permisos suficientes' :
          mpTest?.ok ? 'Conexion exitosa!' : 'Error de conexion'
  })
}
