// Basic Figma plugin to automatically fetch guides from frames
figma.showUI(__html__, { width: 300, height: 540 });

let lastGuidesData = null;
let copiedGuides = null;

function getGuidesFromFrame(frame) {
  if (!frame || frame.type !== "FRAME") {
    return { error: "Please select a frame" };
  }

  if (!("guides" in frame)) {
    return { error: "This frame does not support guides" };
  }

  const guides = frame.guides.map((guide, index) => ({
    index: index,
    axis: guide.axis,
    offset: guide.offset,
  }));

  return {
    frameName: frame.name,
    guidesCount: guides.length,
    guides: guides,
  };
}

function checkSelection() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    lastGuidesData = null;
    figma.ui.postMessage({
      type: "guides-result",
      data: { error: "Please select a frame" },
    });
    return;
  }

  const result = getGuidesFromFrame(selection[0]);
  const currentData = JSON.stringify(result);

  if (currentData !== lastGuidesData) {
    lastGuidesData = currentData;
    figma.ui.postMessage({
      type: "guides-result",
      data: result,
    });
  }
}

function deleteGuide(frame, index) {
  const guides = frame.guides;
  if (Array.isArray(guides) && guides[index]) {
    // Create new guides array excluding the deleted one
    const newGuides = guides
      .filter((_, i) => i !== index)
      .map((guide) => ({ axis: guide.axis, offset: guide.offset }));

    // Directly overwrite the guides array
    frame.guides = newGuides;
  }
}

// Auto-fetch on selection change
figma.on("selectionchange", checkSelection);

// Handle UI messages
figma.ui.onmessage = (msg) => {
  if (msg.type === "delete-guide") {
    const selection = figma.currentPage.selection;
    if (selection.length > 0 && selection[0].type === "FRAME") {
      deleteGuide(selection[0], msg.index);
      checkSelection();
    }
  }

  if (msg.type === "clear-all-guides") {
    const selection = figma.currentPage.selection;
    if (selection.length > 0 && selection[0].type === "FRAME") {
      selection[0].guides = [];
      checkSelection();
    }
  }

  if (msg.type === "add-guide") {
    const selection = figma.currentPage.selection;
    if (selection.length > 0 && selection[0].type === "FRAME") {
      const frame = selection[0];
      let offset = parseFloat(msg.position);

      // Handle percentage
      if (msg.position.includes("%")) {
        const percent = parseFloat(msg.position);
        if (msg.axis === "X") {
          offset = (frame.width * percent) / 100;
        } else {
          offset = (frame.height * percent) / 100;
        }
      }

      // Add the new guide
      const currentGuides = [...frame.guides];
      currentGuides.push({ axis: msg.axis, offset: offset });
      frame.guides = currentGuides;
      checkSelection();
    }
  }

  if (msg.type === "copy-guides") {
    const selection = figma.currentPage.selection;
    if (selection.length > 0 && selection[0].type === "FRAME") {
      const frame = selection[0];
      const copyType = msg.copyType || "px";

      copiedGuides = frame.guides.map((guide) => {
        if (copyType === "%") {
          // Convert to percentage based on frame dimensions
          let percentage;
          if (guide.axis === "X") {
            percentage = (guide.offset / frame.width) * 100;
          } else {
            percentage = (guide.offset / frame.height) * 100;
          }
          return {
            axis: guide.axis,
            offset: percentage,
            type: "%",
          };
        } else {
          return {
            axis: guide.axis,
            offset: guide.offset,
            type: "px",
          };
        }
      });

      figma.ui.postMessage({
        type: "copy-status",
        data: { message: `Copied ${copiedGuides.length} guides (${copyType})` },
      });
    }
  }

  if (msg.type === "paste-guides") {
    const selection = figma.currentPage.selection;
    if (selection.length > 0 && selection[0].type === "FRAME" && copiedGuides) {
      const frame = selection[0];
      const currentGuides = [...frame.guides];

      // Add copied guides to current guides
      copiedGuides.forEach((guide) => {
        let offset = guide.offset;

        // Convert percentage to pixels if needed
        if (guide.type === "%") {
          if (guide.axis === "X") {
            offset = (frame.width * guide.offset) / 100;
          } else {
            offset = (frame.height * guide.offset) / 100;
          }
        }

        currentGuides.push({ axis: guide.axis, offset: offset });
      });

      frame.guides = currentGuides;
      checkSelection();
      figma.ui.postMessage({
        type: "paste-status",
        data: { message: `Pasted ${copiedGuides.length} guides` },
      });
    } else if (!copiedGuides) {
      figma.ui.postMessage({
        type: "paste-status",
        data: { message: "No guides to paste. Copy guides first." },
      });
    }
  }
};

// Check for guide changes every 100ms
setInterval(checkSelection, 100);

// Initial check
checkSelection();
