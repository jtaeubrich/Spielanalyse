// Attach reusable MediaElement audio to a canvas capture stream.
// A failed audio connection preserves the existing silent-video fallback.
export async function connectClipAudio({ video, stream, getState, setState, AudioContextClass }) {
  try {
    const state = getState();
    const context = state.context || new AudioContextClass();
    let source = state.source;
    let destination = state.destination;
    if (!source) {
      source = context.createMediaElementSource(video);
      destination = context.createMediaStreamDestination();
      source.connect(destination);
      source.connect(context.destination);
    }
    setState({ context, source, destination });
    await context.resume();
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
    return { withAudio: true };
  } catch {
    return { withAudio: false };
  }
}
