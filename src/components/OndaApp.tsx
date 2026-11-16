'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Cloud,
  Clock3,
  HardDrive,
  Library,
  LogOut,
  RefreshCw,
  Search,
  TriangleAlert,
  Users
} from 'lucide-react'
import { formatBytes, formatRelativeDate, formatTotalDuration } from '@/lib/format'
import type { LibraryResponse, SortKey, Track } from '@/lib/types'
import { InstallButton } from './InstallButton'
import { PlayerBar } from './PlayerBar'
import { Toasts, type ToastItem, type ToastTone } from './Toasts'
import { TrackList } from './TrackList'
import { UploadPanel } from './UploadPanel'

function StatCard({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail?: string
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate font-mono text-[13px] font-semibold tabular-nums text-zinc-200">
        {value}
      </p>
      {detail && <p className="mt-0.5 truncate text-[10px] text-zinc-600">{detail}</p>}
    </div>
  )
}

export function OndaApp(): React.ReactElement {
  const [tracks, setTracks] = useState<Track[]>([])
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')

  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    if (typeof window === 'undefined') return 0.9
    try {
      const stored = Number(window.localStorage.getItem('onda-volume'))
      return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.9
    } catch {
      return 0.9
    }
  })

  const [toasts, setToasts] = useState<ToastItem[]>([])

  const audioRef = useRef<HTMLAudioElement>(null)
  const toastTimersRef = useRef<number[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = crypto.randomUUID()
      setToasts((previous) => [...previous.slice(-3), { id, message, tone }])
      const timer = window.setTimeout(() => {
        setToasts((previous) => previous.filter((toast) => toast.id !== id))
      }, 5200)
      toastTimersRef.current.push(timer)
    },
    []
  )

  useEffect(() => {
    const timers = toastTimersRef.current
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [])

  const loadTracks = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)

    try {
      const response = await fetch('/api/tracks', { cache: 'no-store' })
      if (response.status === 401) {
        // Recarrega de verdade para o proxy enxergar o cookie expirado.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/login')
        return
      }

      const data = (await response.json().catch(() => ({}))) as Partial<LibraryResponse> & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível carregar a biblioteca.')
      }

      setTracks(Array.isArray(data.tracks) ? data.tracks : [])
      setConfigured(data.configured !== false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a biblioteca.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTracks(true), 0)
    return () => window.clearTimeout(timer)
  }, [loadTracks])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    try {
      window.localStorage.setItem('onda-volume', String(volume))
    } catch {
      // localStorage indisponível
    }
  }, [volume])

  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === currentId) ?? null,
    [tracks, currentId]
  )

  const visibleTracks = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('pt-BR')
    const filtered = search
      ? tracks.filter((track) =>
          [track.title, track.artist, track.album, track.genre ?? ''].some((value) =>
            value.toLocaleLowerCase('pt-BR').includes(search)
          )
        )
      : tracks

    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
    const sorted = [...filtered]
    switch (sort) {
      case 'title':
        sorted.sort((a, b) => collator.compare(a.title, b.title))
        break
      case 'artist':
        sorted.sort((a, b) => collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title))
        break
      case 'album':
        sorted.sort((a, b) => collator.compare(a.album, b.album) || collator.compare(a.title, b.title))
        break
      case 'duration':
        sorted.sort((a, b) => a.duration - b.duration)
        break
      case 'recent':
      default:
        sorted.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))
        break
    }
    return sorted
  }, [tracks, query, sort])

  const totalDuration = useMemo(
    () => tracks.reduce((total, track) => total + (track.duration || 0), 0),
    [tracks]
  )

  const totalSize = useMemo(
    () => tracks.reduce((total, track) => total + (track.size || 0), 0),
    [tracks]
  )

  const latestUpload = useMemo(() => {
    let latest = ''
    for (const track of tracks) {
      if (Date.parse(track.uploadedAt) > Date.parse(latest || '0')) latest = track.uploadedAt
    }
    return latest
  }, [tracks])

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    setCurrentId(null)
    setPlaying(false)
    setPosition(0)
    setDuration(0)
  }, [])

  const startTrack = useCallback(
    async (track: Track) => {
      const audio = audioRef.current
      if (!audio) return

      if (currentId === track.id) {
        if (audio.paused) {
          try {
            await audio.play()
            setPlaying(true)
          } catch {
            pushToast('Não foi possível continuar a música.', 'error')
          }
        } else {
          audio.pause()
          setPlaying(false)
        }
        return
      }

      audio.pause()
      audio.src = track.url
      audio.currentTime = 0
      setCurrentId(track.id)
      setPosition(0)
      setDuration(track.duration || 0)

      try {
        await audio.play()
        setPlaying(true)
      } catch {
        setPlaying(false)
        pushToast('Não foi possível tocar esta música. Verifique a conexão e tente de novo.', 'error')
      }
    },
    [currentId, pushToast]
  )

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentId) return
    if (audio.paused) {
      void audio.play().catch(() => pushToast('Não foi possível tocar a música.', 'error'))
    } else {
      audio.pause()
    }
  }, [currentId, pushToast])

  const seek = useCallback((value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setPosition(value)
  }, [])

  const stepTrack = useCallback(
    (direction: 1 | -1) => {
      if (visibleTracks.length === 0) return
      const index = visibleTracks.findIndex((track) => track.id === currentId)
      const nextIndex = index >= 0 ? (index + direction + visibleTracks.length) % visibleTracks.length : 0
      void startTrack(visibleTracks[nextIndex])
    },
    [visibleTracks, currentId, startTrack]
  )

  const handleEnded = useCallback(() => {
    const index = visibleTracks.findIndex((track) => track.id === currentId)
    if (index >= 0 && index < visibleTracks.length - 1) {
      void startTrack(visibleTracks[index + 1])
    } else {
      setPlaying(false)
      setPosition(0)
    }
  }, [visibleTracks, currentId, startTrack])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.code === 'Space' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (!currentId) {
          if (visibleTracks[0]) {
            event.preventDefault()
            void startTrack(visibleTracks[0])
          }
          return
        }
        event.preventDefault()
        togglePlay()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentId, visibleTracks, startTrack, togglePlay])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const audio = audioRef.current

    if (currentTrack && typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: currentTrack.coverUrl
          ? [{ src: currentTrack.coverUrl, sizes: '512x512' }]
          : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
      })
    }

    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'

    const handlers: Array<[MediaSessionAction, (() => void) | null]> = [
      ['play', () => void audio?.play()],
      ['pause', () => audio?.pause()],
      ['previoustrack', () => stepTrack(-1)],
      ['nexttrack', () => stepTrack(1)]
    ]
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // ação não suportada
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // ação não suportada
        }
      }
    }
  }, [currentTrack, playing, stepTrack])

  const handleUploaded = useCallback((track: Track) => {
    setTracks((previous) => [track, ...previous.filter((item) => item.id !== track.id)])
  }, [])

  const deleteTrack = useCallback(
    async (track: Track) => {
      const confirmed = window.confirm(
        `Remover “${track.title}” da biblioteca?\n\nO arquivo também será apagado do armazenamento.`
      )
      if (!confirmed) return

      try {
        const response = await fetch(`/api/tracks?id=${encodeURIComponent(track.id)}`, {
          method: 'DELETE'
        })
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) {
          throw new Error(data.error || 'Não foi possível remover a música.')
        }

        setTracks((previous) => previous.filter((item) => item.id !== track.id))
        if (currentId === track.id) stopAudio()
        pushToast('Música removida da biblioteca.', 'success')
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Não foi possível remover a música.', 'error')
      }
    },
    [currentId, pushToast, stopAudio]
  )

  const logout = useCallback(async () => {
    audioRef.current?.pause()
    try {
      await fetch('/api/logout', { method: 'POST' })
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login')
    }
  }, [])

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-zinc-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/onda.png"
            alt=""
            width={38}
            height={38}
            className="h-9 w-9 rounded-xl shadow-lg shadow-emerald-500/10 ring-1 ring-white/10"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold tracking-tight text-zinc-50">Onda</h1>
              <span className="chip !h-5 !px-1.5 !text-[9.5px]">WEB</span>
            </div>
            <p className="hidden text-[11px] text-zinc-500 sm:block">biblioteca compartilhada</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <InstallButton />
            <button
              type="button"
              onClick={() => void loadTracks(false)}
              disabled={refreshing}
              className="icon-btn h-8 w-8"
              title="Atualizar biblioteca"
              aria-label="Atualizar biblioteca"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="icon-btn h-8 w-8"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
            <a
              href="https://github.com/TheErickGustavo/onda"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-zinc-100 hover:text-white text-[10px] uppercase"
            >
              GitHub
            </a>
          </div>
          <a
            href="https://github.com/TheErickGustavo/AppMusica"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-zinc-400 hover:text-white text-[10px] uppercase"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-44 pt-6 sm:px-6 sm:pb-28">
        {!configured && (
          <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="text-[12.5px] font-medium text-amber-100">Armazenamento ainda não configurado</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-200/65">
                Conecte um Vercel Blob ao projeto para ativar os envios e a biblioteca compartilhada.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-3.5 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-rose-100">Não foi possível carregar a biblioteca</p>
              <p className="mt-0.5 break-words text-[11.5px] leading-relaxed text-rose-200/65">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadTracks(false)}
              className="shrink-0 rounded-lg border border-rose-300/20 px-2.5 py-1 text-[11px] text-rose-100 transition hover:bg-rose-300/10"
            >
              Tentar
            </button>
          </div>
        )}

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
          <UploadPanel disabled={!configured} onUploaded={handleUploaded} onToast={pushToast} />

          <div className="surface flex flex-col justify-between p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                  Visão geral
                </p>
                <p className="mt-1 text-[20px] font-semibold tracking-tight text-zinc-50">
                  {tracks.length}
                  <span className="ml-1 text-[11.5px] font-normal text-zinc-500">
                    {tracks.length === 1 ? 'música' : 'músicas'}
                  </span>
                </p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                <Library className="h-4 w-4 text-zinc-400" />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <StatCard
                icon={<Clock3 className="h-2.5 w-2.5" />}
                label="Duração"
                value={formatTotalDuration(totalDuration)}
              />
              <StatCard
                icon={<HardDrive className="h-2.5 w-2.5" />}
                label="Tamanho"
                value={formatBytes(totalSize)}
              />
              <StatCard
                icon={<Cloud className="h-2.5 w-2.5" />}
                label="Último envio"
                value={latestUpload ? formatRelativeDate(latestUpload) : '—'}
              />
              <StatCard
                icon={<Users className="h-2.5 w-2.5" />}
                label="Acesso"
                value="Compartilhado"
                detail={configured ? 'Vercel Blob' : 'pendente'}
              />
            </div>
          </div>
        </section>

        <section className="surface mt-3 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-zinc-100">Sua biblioteca</h2>
              <span className="chip !h-5 !px-1.5 !text-[10px]">{visibleTracks.length}</span>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar…"
                  aria-label="Buscar músicas"
                  className="h-8 w-40 rounded-lg border border-white/[0.07] bg-black/20 pl-8 pr-2 text-[11.5px] text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/35 focus:ring-2 focus:ring-emerald-400/10 sm:w-52"
                />
              </div>

              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Ordenar músicas"
                className="h-8 cursor-pointer rounded-lg border border-white/[0.07] bg-black/20 px-2 text-[11.5px] text-zinc-300 outline-none transition focus:border-emerald-400/35"
              >
                <option value="recent">Recentes</option>
                <option value="title">Título</option>
                <option value="artist">Artista</option>
                <option value="album">Álbum</option>
                <option value="duration">Duração</option>
              </select>
            </div>
          </div>

          <TrackList
            tracks={visibleTracks}
            loading={loading}
            currentId={currentId}
            playing={playing}
            query={query}
            onPlay={startTrack}
            onDelete={deleteTrack}
          />
        </section>

        <p className="mt-3 px-1 text-center text-[10.5px] leading-relaxed text-zinc-700">
          Espaço para tecla: play/pause · os envios ficam disponíveis para todos que usam a mesma senha.
        </p>
      </main>

      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value) && value > 0) setDuration(value)
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value) && value > 0) setDuration(value)
        }}
        onEnded={handleEnded}
        onError={() => {
          if (currentId) {
            pushToast('Erro ao carregar o áudio. Verifique a conexão e tente de novo.', 'error')
          }
        }}
      />

      <PlayerBar
        track={currentTrack}
        playing={playing}
        position={position}
        duration={duration}
        volume={volume}
        onTogglePlay={togglePlay}
        onPrev={() => stepTrack(-1)}
        onNext={() => stepTrack(1)}
        onSeek={seek}
        onVolume={setVolume}
      />

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
