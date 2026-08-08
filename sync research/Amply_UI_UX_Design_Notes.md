# Amply UI / UX Design Notes (Living Document)

> Status: Draft v0.1\
> Purpose: Store long-term UI/UX ideas before implementation.

------------------------------------------------------------------------

# Core Philosophy

Amply should feel like a **premium music experience**, not a generic web
application.

Keywords:

-   Minimal
-   Premium
-   Music-first
-   Interactive
-   Modern
-   Elegant motion over excessive effects

The focus should always remain on the currently playing song.

------------------------------------------------------------------------

# Primary Layout

The "Now Playing" section becomes the visual centerpiece.

    Album

    Playback Controls

    Queue

The eye should naturally move from:

1.  Album artwork
2.  Song information
3.  Playback controls
4.  Queue

------------------------------------------------------------------------

# Signature Component --- Now Playing Stage

The current song should be displayed as a premium interactive component.

## Album Card

-   Based on the React Bits Tilted Card concept.
-   Album artwork centered.
-   Subtle 3D tilt following cursor movement.
-   Smooth easing.
-   Dynamic shadow based on tilt.
-   Layered depth (artwork, shadow, reflection).

### Important

The interaction should feel physical, not exaggerated.

Avoid:

-   Large rotations
-   Fast movement
-   Excessive hover effects

------------------------------------------------------------------------

# Vinyl Record Background

## Concept

Behind the square album artwork sits a much larger vinyl record.

Only the outer edge of the vinyl is visible.

          ◌◌◌◌◌◌◌◌

        ◌   Album   ◌

          ◌◌◌◌◌◌◌◌

The album cover acts as the record label.

------------------------------------------------------------------------

# Vinyl Animation

When music is playing:

-   Slow continuous rotation
-   One rotation roughly every 20--40 seconds
-   Smooth and subtle

When paused:

-   Rotation eases naturally to a stop

When a new song starts:

1.  Record slows
2.  Album artwork transitions
3.  Record accelerates smoothly
4.  Playback resumes

------------------------------------------------------------------------

# Interaction Behaviour

The album and vinyl should behave independently.

### Mouse Movement

Album: - Tilts with cursor - Dynamic shadow - Slight depth effect

Vinyl: - Continues rotating independently - Does NOT tilt

This separation should create a premium layered effect.

------------------------------------------------------------------------

# Adaptive Lighting (Future Idea)

Extract dominant colors from the current album artwork.

Use them to subtly tint:

-   Ambient glow
-   Vinyl rim lighting
-   Soft background illumination

The vinyl itself should remain mostly black.

------------------------------------------------------------------------

# Playback Controls

Status: Not finalised.

Current plan:

-   Replace existing controls later.
-   Research premium playback control designs.
-   Find inspiration before implementation.

Do NOT lock in a design yet.

------------------------------------------------------------------------

# Background

The Strands shader remains a future possibility.

Current decision:

-   Do not implement yet.
-   Priority is the Now Playing experience.
-   Revisit after the redesign if it still fits.

Possible future enhancement:

-   Music-reactive strands
-   Beat-responsive animation
-   Party-energy-driven motion

------------------------------------------------------------------------

# Overall Experience

Users should feel like they are interacting with a premium music object
rather than a standard media player.

Everything should support the currently playing song without distracting
from it.

------------------------------------------------------------------------

# Future Research

To explore later:

-   Premium playback controls
-   Queue redesign
-   Song transition animations
-   Motion system
-   Typography
-   Color palette
-   Design system
-   Mobile interactions
