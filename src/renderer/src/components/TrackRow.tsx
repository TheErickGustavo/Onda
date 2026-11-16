import { memo, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react'
import { MoreHorizontal, Pause, Play } from 'lucide-react'
import type { Track } from '@shared/music'
import { CoverArt } from './CoverArt'
import { FeedbackButtons } from './FeedbackButtons'
import { formatCount, formatRelativeDate, formatTime } from '@/lib/format'

export const GRID_TEMPLATE =
  'grid grid-cols-[26px_minmax(0,2.3fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_92px_64px_118px] items-center gap-x-3'

interface TrackRowProps {
  track: Track
  displayNumber: number
  isCurrent: boolean
  isPlaying: boolean
  isSelected: boolean
  height: number
  isDisliked: boolean
  /** Seleção múltipla ativa em outras linhas → checkbox visual na coluna #. */
  selectionMode?: boolean
  /** Drag & drop interno da playlist (ordem manual). */
  reorderable?: boolean
  isDropTarget?: boolean
  onSelect: (track: Track, event: ReactMouseEvent) => void
  onPlay: (track: Track) => void
  onContextMenu: (e: ReactMouseEvent, track: Track) => void
  onToggleLike: (track: Track) => void
  onToggleDislike: (track: Track) => void
  onMore: (e: ReactMouseEvent, track: Track) => void
  onDragStartRow?: (track: Track, event: ReactDragEvent) => void
  onDragOverRow?: (track: Track, event: ReactDragEvent) => void
  onDropRow?: (track: Track, event: ReactDragEvent) => void
  onDragEndRow?: () => void
}

/** Linha da tabela — memo puro: 10k faixas re-renderizam só as janelas visíveis. */
export const TrackRow = memo(function TrackRow({
  track,
  displayNumber,
  isCurrent,
  isPlaying,
  isSelected,
  height,
  isDisliked,
  selectionMode = false,
  reorderable = false,
  isDropTarget = false,
  onSelect,
  onPlay,
  onContextMenu,
  onToggleLike,
  onToggleDislike,
  onMore,
  onDragStartRow,
  onDragOverRow,
  onDropRow,
  onDragEndRow
}: TrackRowProps): ReactElement {
  return (
    <div
      role="row"
      aria-current={isCurrent ? 'true' : undefined}
      aria-selected={isSelected}
      title={`${track.filePath}\n${track.codec ?? ''}${track.bitrate ? ` · ${track.bitrate} kbps` : ''}${track.sampleRate ? ` · ${track.sampleRate} Hz` : ''}`}
      draggable={reorderable}
      onClick={(e) => onSelect(track, e)}
      onDoubleClick={() => onPlay(track)}
      onContextMenu={(e) => onContextMenu(e, track)}
      onDragStart={reorderable ? (e) => onDragStartRow?.(track, e) : undefined}
      onDragOver={reorderable ? (e) => onDragOverRow?.(track, e) : undefined}
      onDrop={reorderable ? (e) => onDropRow?.(track, e) : undefined}
      onDragEnd={reorderable ? () => onDragEndRow?.() : undefined}
      style={{ height }}
      className={`group/row relative cursor-default select-none border-b border-white/[0.025] px-5 ${GRID_TEMPLATE} transition-colors duration-100 ${
        isSelected
          ? 'bg-emerald-400/[0.07]'
          : isCurrent
            ? 'bg-white/[0.05]'
            : 'hover:bg-white/[0.035]'
      }`}
    >
      {isCurrent && <span className="absolute inset-y-0 left-0 w-[2.5px] rounded-full bg-emerald-400" />}
      {isDropTarget && <span className="absolute inset-x-0 top-0 h-[2px] bg-emerald-400/80" />}

      {/* nº / estado (+ checkbox em modo seleção) */}
      <div className="relative flex h-full items-center justify-center text-[12px]">
        {selectionMode ? (
          <span
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-colors ${
              isSelected ? 'border-emerald-400 bg-emerald-500/80' : 'border-white/20 bg-transparent'
            }`}
            aria-hidden
          >
            {isSelected && (
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 text-zinc-950" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M1.5 5.2 L3.8 7.5 L8.5 2.5" />
              </svg>
            )}
          </span>
        ) : isCurrent ? (
          <>
            <div className={`flex h-3.5 items-end gap-[2px] ${isPlaying ? '' : 'eq-paused opacity-60'}`} aria-hidden>
              <span className="eq-bar w-[2.5px] rounded-sm bg-emerald-400" style={{ height: '100%' }} />
              <span className="eq-bar w-[2.5px] rounded-sm bg-emerald-400" style={{ height: '100%' }} />
              <span className="eq-bar w-[2.5px] rounded-sm bg-emerald-400" style={{ height: '100%' }} />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPlay(track)
              }}
              className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 text-zinc-100 opacity-0 transition-opacity group-hover/row:opacity-100"
              title={isPlaying ? 'Pausar' : 'Retomar'}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
            </button>
          </>
        ) : (
          <>
            <span className={`tnum font-mono text-zinc-600 group-hover/row:opacity-0 ${isDisliked ? 'text-zinc-700' : ''}`}>{displayNumber}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPlay(track)
              }}
              className="absolute inset-0 flex items-center justify-center text-zinc-100 opacity-0 transition-opacity group-hover/row:opacity-100"
              title="Tocar"
            >
              <Play className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          </>
        )}
      </div>

      {/* capa + título */}
      <div className="flex min-w-0 items-center gap-3">
        <CoverArt coverPath={track.coverPath} seed={track.filePath} label={track.title} className="h-9 w-9" rounded="rounded" />
        <div className="min-w-0">
          <div className={`truncate-1 text-[13px] font-medium ${isCurrent ? 'text-emerald-400' : isDisliked ? 'text-zinc-500' : 'text-zinc-100'}`}>
            {track.title}
          </div>
          <div className="truncate-1 text-[11px] text-zinc-500">{track.artist}</div>
        </div>
      </div>

      {/* artista (dedup visual: artista tem peso próprio na ordenação) */}
      <div className="truncate-1 text-[12.5px] text-zinc-400">{track.artist}</div>

      {/* álbum */}
      <div className="flex min-w-0 flex-col">
        <span className="truncate-1 text-[12.5px] text-zinc-400">{track.album}</span>
        <span className="truncate-1 text-[10.5px] text-zinc-600">
          {track.year ?? '—'}
          {track.genre ? ` · ${track.genre}` : ''}
        </span>
      </div>

      {/* plays */}
      <div className="flex items-center justify-end gap-1.5" title={`Última audição: ${formatRelativeDate(track.lastPlayedAt)}`}>
        {track.playCount > 0 ? (
          <>
            <Play className="h-2.5 w-2.5 text-zinc-600" fill="currentColor" />
            <span className={`tnum font-mono text-[12px] ${track.playCount >= 10 ? 'text-zinc-200' : 'text-zinc-400'}`}>{formatCount(track.playCount)}</span>
          </>
        ) : (
          <span className="text-[11px] text-zinc-700">—</span>
        )}
      </div>

      {/* duração */}
      <div className="tnum text-right font-mono text-[12px] text-zinc-400">{track.duration > 0 ? formatTime(track.duration) : '—'}</div>

      {/* feedback + menu */}
      <div className="flex items-center justify-end gap-0.5">
        <div className={track.feedback === 'neutral' ? 'opacity-0 transition-opacity group-hover/row:opacity-100' : ''}>
          <FeedbackButtons
            feedback={track.feedback}
            onToggleLike={() => onToggleLike(track)}
            onToggleDislike={() => onToggleDislike(track)}
          />
        </div>
        <button
          type="button"
          title="Mais ações"
          onClick={(e) => {
            e.stopPropagation()
            onMore(e, track)
          }}
          className="icon-btn !h-7 !w-7 opacity-0 transition-opacity group-hover/row:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
})
