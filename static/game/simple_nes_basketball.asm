; simple_nes_basketball.asm
; clean-room starter, not based on Double Dribble source

.segment "HEADER"
  .byte "NES", $1A
  .byte 2          ; 2 x 16KB PRG
  .byte 1          ; 1 x 8KB CHR
  .byte $00
  .byte $00
  .byte $00, $00, $00, $00, $00, $00, $00, $00

.segment "ZEROPAGE"
player_x:      .res 1
player_y:      .res 1
controller_1:  .res 1
controller_old:.res 1
frame_ready:   .res 1

.segment "CODE"

.proc NMI
  pha
  txa
  pha
  tya
  pha

  lda #$00
  sta $2003
  lda #$02
  sta $4014       ; DMA from $0200 to OAM

  lda #$01
  sta frame_ready

  pla
  tay
  pla
  tax
  pla
  rti
.endproc

.proc RESET
  sei
  cld
  ldx #$40
  stx $4017
  ldx #$FF
  txs
  inx
  stx $2000
  stx $2001
  stx $4010

: lda $2002
  bpl :-

clear_ram:
  lda #$00
  tay
@loop:
  sta $0000,y
  sta $0100,y
  sta $0200,y
  sta $0300,y
  sta $0400,y
  sta $0500,y
  sta $0600,y
  sta $0700,y
  iny
  bne @loop

  lda #120
  sta player_x
  lda #160
  sta player_y

vblank_wait:
  bit $2002
  bpl vblank_wait

  lda #%10010000
  sta $2000
  lda #%00011110
  sta $2001

main_loop:
  lda frame_ready
  beq main_loop
  lda #$00
  sta frame_ready

  jsr ReadController
  jsr UpdatePlayer
  jsr DrawPlayerSprite

  jmp main_loop
.endproc

.proc ReadController
  lda controller_1
  sta controller_old

  lda #$01
  sta $4016
  lda #$00
  sta $4016

  ldx #$08
  lda #$00
@read:
  pha
  lda $4016
  and #$01
  sta $00
  pla
  asl
  ora $00
  dex
  bne @read

  sta controller_1
  rts
.endproc

; NES button bits after read may vary by routine convention
; here we'll treat:
; bit 7 = A
; bit 6 = B
; bit 5 = Select
; bit 4 = Start
; bit 3 = Up
; bit 2 = Down
; bit 1 = Left
; bit 0 = Right

.proc UpdatePlayer
  lda controller_1
  and #%00000001
  beq @no_right
  lda player_x
  cmp #240
  bcs @no_right
  clc
  adc #1
  sta player_x
@no_right:

  lda controller_1
  and #%00000010
  beq @no_left
  lda player_x
  beq @no_left
  sec
  sbc #1
  sta player_x
@no_left:

  lda controller_1
  and #%00000100
  beq @no_down
  lda player_y
  cmp #220
  bcs @no_down
  clc
  adc #1
  sta player_y
@no_down:

  lda controller_1
  and #%00001000
  beq @no_up
  lda player_y
  cmp #8
  bcc @no_up
  sec
  sbc #1
  sta player_y
@no_up:

  rts
.endproc

.proc DrawPlayerSprite
  ; OAM buffer at $0200
  lda player_y
  sta $0200       ; Y
  lda #$20
  sta $0201       ; tile index
  lda #$00
  sta $0202       ; attributes
  lda player_x
  sta $0203       ; X
  rts
.endproc

.proc IRQ
  rti
.endproc

.segment "VECTORS"
  .word NMI
  .word RESET
  .word IRQ

.segment "CHARS"
  .incbin "basketball.chr"
