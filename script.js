const margin = { top: 90, right: 160, bottom: 55, left: 120 };

const width = 3500 - margin.left - margin.right;
const height = 1200 - margin.top - margin.bottom;

const FONT_SIZE = {
  axisTitle: "24px",
  axisTick: "22px",
  splitLabel: "20px",
  info: "20px",
  tooltip: "18px",
  winRateLabel: "24px"
};

// Rank 축 브러싱 시 얇은 노란색 보조선 설정
const RANK_HIGHLIGHT_COLOR = "#FFD700";
const RANK_HIGHLIGHT_OPACITY = 0.5;
const RANK_HIGHLIGHT_WIDTH = 0.65;

// 승률 축 표시 설정
const WIN_RATE_DIMENSION = "WinRate";
const WIN_RATE_COLOR = "#F28C28";
const WIN_RATE_LINE_WIDTH = 4;

// POT 축과 WinRate 축 사이 거리
// 숫자가 작을수록 WinRate 축이 POT 축에 가까워짐
const WIN_RATE_GAP_FROM_POT = 180;

const chartContainer = d3.select("#chart");
const tooltip = d3.select("#tooltip");
const info = d3.select("#info");
const tableInfo = d3.select("#tableInfo");
const tableHead = d3.select("#dataTable thead");
const tableBody = d3.select("#dataTable tbody");

tooltip
  .style("font-size", FONT_SIZE.tooltip)
  .style("line-height", "1.6")
  .style("padding", "10px 12px");

// 승리형/패배형 리프노드가 추가된 최종 CSV 사용
// 파일명: kbl7_outcome_leafnode.csv
d3.csv("kbl7_outcome_leafnode.csv", d3.autoType).then(data => {
  console.log("불러온 데이터:", data);
  console.log("컬럼명:", data.columns);

  data.forEach((d, i) => {
    d.__rowId = i;
    d.Result = String(d.Result).toUpperCase();
    d.Season = String(d.Season ?? "");
    d.Team = String(d.Team ?? "");
    d.Rank = String(d.Rank ?? "");
    d.LeafNode = String(d.LeafNode ?? "");
    d.OutcomeType = String(d.OutcomeType ?? "");
    d.LeafDisplay = String(d.LeafDisplay ?? "");
    d.TreeRule = String(d.TreeRule ?? "");
    d.LeafInterpretation = String(d.LeafInterpretation ?? "");
  });

  // 최종 표시 축 순서
  // 팀명 → 시즌 → 순위 → 승패 → 어시스트 → 리바운드 → 3점슛성공률 → 2점슛성공률 → 턴오버 기반 득점 → 승률
  const categoricalDimensions = ["Team", "Season", "Result"];
  const numericDimensions = ["Rank", "AS", "RB", "3ptRatio", "2ptRatio", "POT", WIN_RATE_DIMENSION];
  const dimensions = ["Team", "Season", "Rank", "Result", "AS", "RB", "3ptRatio", "2ptRatio", "POT", WIN_RATE_DIMENSION];

  // 실제 경기 데이터 선에는 승률 축을 포함하지 않음
  // 승률은 선택된 데이터 전체의 집계값이므로 별도의 주황색 기준선으로 표시
  const pathDimensions = dimensions.filter(dim => dim !== WIN_RATE_DIMENSION);
  const brushDimensions = dimensions.filter(dim => dim !== WIN_RATE_DIMENSION);

  const tableColumns = [
    "Season",
    "Team",
    "Rank",
    "Result",
    "AS",
    "RB",
    "3ptRatio",
    "2ptRatio",
    "POT",
    "LeafNode",
    "OutcomeType",
    "LeafWinRate",
    "LeafLoseRate",
    "TreeRule",
    "LeafInterpretation"
  ];

  const jitterTargets = ["Rank", "AS", "RB", "POT"];
  const jitterAmount = {
    Rank: 0.08,
    AS: 0.25,
    RB: 0.35,
    POT: 0.22
  };

  const categoricalJitterTargets = ["Team", "Season", "Result"];
  const categoricalJitterAmount = {
    Team: 8,
    Season: 8,
    Result: 8
  };

  const splitLines = {
    "AS": [19.5],
    "RB": [33.5, 34.5],
    "3ptRatio": [28.35, 36.25, 41.55],
    "2ptRatio": [51.05, 55.50],
    "POT": [12.5, 13.5]
  };

  const leafOrder = [
    "N6",
    "N7",
    "N8",
    "N11",
    "N13",
    "N14",
    "N15",
    "N17",
    "N19",
    "N20",
    "N21",
    "N22"
  ];

  const leafNodeLabels = {};

  leafOrder.forEach(node => {
    const row = data.find(d => d.LeafNode === node);

    if (row) {
      const display = row.LeafDisplay && row.LeafDisplay !== "undefined"
        ? row.LeafDisplay
        : `${node} | ${row.OutcomeType}`;

      leafNodeLabels[node] = display;
    }
  });

  const seasonFilter = d3.select("#seasonFilter");
  const resultFilter = d3.select("#resultFilter");
  const teamFilter = d3.select("#teamFilter");
  const rankFilter = d3.select("#rankFilter");
  const leafNodeFilter = d3.select("#leafNodeFilter");
  const outcomeTypeFilter = d3.select("#outcomeTypeFilter");

  function clearAndAppendAll(selectBox, allLabel = "All") {
    if (selectBox.empty()) return;

    selectBox.selectAll("option").remove();

    selectBox.append("option")
      .attr("value", "all")
      .text(allLabel);
  }

  clearAndAppendAll(seasonFilter);
  clearAndAppendAll(resultFilter);
  clearAndAppendAll(teamFilter);
  clearAndAppendAll(rankFilter);
  clearAndAppendAll(leafNodeFilter);
  clearAndAppendAll(outcomeTypeFilter);

  if (!seasonFilter.empty()) {
    const seasons = [...new Set(data.map(d => String(d.Season)))].sort().reverse();

    seasons.forEach(season => {
      seasonFilter.append("option")
        .attr("value", season)
        .text(season);
    });
  }

  if (!teamFilter.empty()) {
    const teams = [...new Set(data.map(d => String(d.Team)))].sort();

    teams.forEach(team => {
      teamFilter.append("option")
        .attr("value", team)
        .text(team);
    });
  }

  if (!rankFilter.empty()) {
    const ranks = [...new Set(data.map(d => String(d.Rank)))]
      .sort((a, b) => Number(a) - Number(b));

    ranks.forEach(rank => {
      rankFilter.append("option")
        .attr("value", rank)
        .text(rank);
    });
  }

  if (!resultFilter.empty()) {
    const results = [...new Set(data.map(d => String(d.Result)))].sort();

    results.forEach(result => {
      resultFilter.append("option")
        .attr("value", result)
        .text(result);
    });
  }

  if (!outcomeTypeFilter.empty()) {
    const outcomeTypes = [...new Set(data.map(d => String(d.OutcomeType)))]
      .filter(v => v && v !== "undefined")
      .sort();

    outcomeTypes.forEach(type => {
      outcomeTypeFilter.append("option")
        .attr("value", type)
        .text(type);
    });
  }

  if (!leafNodeFilter.empty()) {
    leafOrder
      .filter(node => data.some(d => d.LeafNode === node))
      .forEach(node => {
        leafNodeFilter.append("option")
          .attr("value", node)
          .text(leafNodeLabels[node] || node);
      });
  }

  function stableHash(str) {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }

    return Math.abs(hash);
  }

  function getStableJitter(rowId, dim, amount) {
    const h = stableHash(`${rowId}-${dim}`);
    const normalized = (h % 10000) / 10000;

    return (normalized * 2 - 1) * amount;
  }

  function getDisplayValue(dim, d) {
    if (categoricalDimensions.includes(dim)) {
      return String(d[dim]);
    }

    if (dim === WIN_RATE_DIMENSION) {
      return null;
    }

    const value = Number(d[dim]);

    if (Number.isNaN(value)) {
      return value;
    }

    if (jitterTargets.includes(dim)) {
      return value + getStableJitter(d.__rowId, dim, jitterAmount[dim] || 0.2);
    }

    return value;
  }

  function getOriginalValue(dim, d) {
    if (categoricalDimensions.includes(dim)) {
      return String(d[dim]);
    }

    if (dim === WIN_RATE_DIMENSION) {
      return null;
    }

    return Number(d[dim]);
  }

  function getLineColor(d) {
    return d.Result === "WIN" ? "steelblue" : "tomato";
  }

  function formatNumber(value) {
    const num = Number(value);

    if (Number.isNaN(num)) {
      return value;
    }

    return Number.isInteger(num) ? num : num.toFixed(2);
  }

  function calculateWinRate(rows) {
    const total = rows.length;

    if (total === 0) {
      return 0;
    }

    const winCount = rows.filter(d => d.Result === "WIN").length;

    return winCount / total * 100;
  }

  function getLineStyle(rowCount) {
    if (rowCount > 1000) {
      return {
        opacity: 0.16,
        width: 0.65
      };
    }

    if (rowCount > 500) {
      return {
        opacity: 0.22,
        width: 0.75
      };
    }

    if (rowCount > 200) {
      return {
        opacity: 0.32,
        width: 0.90
      };
    }

    return {
      opacity: 0.48,
      width: 1.10
    };
  }

  function renderTable(rows) {
    tableHead.html("");
    tableBody.html("");

    tableInfo.text(`하단 표 데이터 수: ${rows.length}개`);

    const headerRow = tableHead.append("tr");

    tableColumns.forEach(col => {
      headerRow.append("th").text(col);
    });

    const tableRows = tableBody.selectAll("tr")
      .data(rows)
      .enter()
      .append("tr");

    tableColumns.forEach(col => {
      tableRows.append("td").text(d => d[col] ?? "");
    });
  }

  function buildLeafSummary(rows) {
    const total = rows.length;
    const winCount = rows.filter(d => d.Result === "WIN").length;
    const loseCount = rows.filter(d => d.Result === "LOSE").length;
    const winRate = total > 0 ? (winCount / total * 100).toFixed(1) : "0.0";
    const loseRate = total > 0 ? (loseCount / total * 100).toFixed(1) : "0.0";

    const selectedLeaf = leafNodeFilter.empty() ? "all" : leafNodeFilter.property("value");
    const selectedOutcomeType = outcomeTypeFilter.empty() ? "all" : outcomeTypeFilter.property("value");

    const leafText = selectedLeaf === "all"
      ? "전체 리프노드"
      : (leafNodeLabels[selectedLeaf] || selectedLeaf);

    const outcomeText = selectedOutcomeType === "all"
      ? "전체 유형"
      : selectedOutcomeType;

    return `${leafText} | ${outcomeText} | n=${total}, WIN=${winCount}, LOSE=${loseCount}, 승률=${winRate}%, 패률=${loseRate}%`;
  }

  function makeTooltipHtml(d) {
    return `
      <b>${d.Team}</b><br>
      Season: ${d.Season}<br>
      Rank: ${d.Rank}<br>
      Result: ${d.Result}<br>
      <hr>
      AS: ${formatNumber(d.AS)}<br>
      RB: ${formatNumber(d.RB)}<br>
      3ptRatio: ${formatNumber(d["3ptRatio"])}<br>
      2ptRatio: ${formatNumber(d["2ptRatio"])}<br>
      POT: ${formatNumber(d.POT)}<br>
      <hr>
      LeafNode: ${d.LeafNode}<br>
      OutcomeType: ${d.OutcomeType}<br>
      LeafWinRate: ${formatNumber(d.LeafWinRate)}%<br>
      LeafLoseRate: ${formatNumber(d.LeafLoseRate)}%<br>
      Rule: ${d.TreeRule}<br>
      Interpretation: ${d.LeafInterpretation}
    `;
  }

  function drawChart(filteredData) {
    chartContainer.selectAll("*").remove();

    const svg = chartContainer
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 일반 축은 실제 경기지표까지만 균등 배치
    const xBase = d3.scalePoint()
      .domain(pathDimensions)
      .range([0, width])
      .padding(0.35);

    // WinRate 축만 POT 축 가까이에 별도 배치
    function getX(dim) {
      if (dim === WIN_RATE_DIMENSION) {
        return xBase("POT") + WIN_RATE_GAP_FROM_POT;
      }

      return xBase(dim);
    }

    const y = {};
    const categoricalDomains = {};

    categoricalDimensions.forEach(dim => {
      let domainValues;

      if (dim === "Result") {
        domainValues = ["LOSE", "WIN"];
      } else if (dim === "Team") {
        domainValues = [...new Set(data.map(d => String(d.Team)))].sort();
      } else if (dim === "Season") {
        domainValues = [...new Set(data.map(d => String(d.Season)))].sort().reverse();
      } else {
        domainValues = [...new Set(data.map(d => String(d[dim])))].sort();
      }

      categoricalDomains[dim] = domainValues;

      y[dim] = d3.scalePoint()
        .domain(domainValues)
        .range([height, 0])
        .padding(0.5);
    });

    numericDimensions.forEach(dim => {
      if (dim === WIN_RATE_DIMENSION) {
        y[dim] = d3.scaleLinear()
          .domain([0, 100])
          .range([height, 0]);

        return;
      }

      const values = data
        .map(d => getDisplayValue(dim, d))
        .filter(v => !Number.isNaN(v));

      const domainMin = d3.min(values);
      const domainMax = d3.max(values);
      const padding = (domainMax - domainMin) * 0.04 || 1;

      if (dim === "Rank") {
        y[dim] = d3.scaleLinear()
          .domain([domainMax + padding, domainMin - padding])
          .range([height, 0]);
      } else {
        y[dim] = d3.scaleLinear()
          .domain([domainMin - padding, domainMax + padding])
          .range([height, 0]);
      }
    });

    function getY(dim, d) {
      if (categoricalDimensions.includes(dim)) {
        const baseY = y[dim](String(d[dim]));

        if (categoricalJitterTargets.includes(dim)) {
          const jitteredY = baseY + getStableJitter(
            d.__rowId,
            `${dim}-categorical`,
            categoricalJitterAmount[dim] || 8
          );

          return Math.max(0, Math.min(height, jitteredY));
        }

        return baseY;
      }

      return y[dim](getDisplayValue(dim, d));
    }

    function path(d) {
      return d3.line()(
        pathDimensions.map(dim => [getX(dim), getY(dim, d)])
      );
    }

    const lineStyle = getLineStyle(filteredData.length);
    const lineOpacity = lineStyle.opacity;
    const lineWidth = lineStyle.width;

    info
      .style("font-size", FONT_SIZE.info)
      .style("font-weight", "600")
      .style("margin", "12px 0")
      .text(`현재 표시 데이터: ${filteredData.length}개 | ${buildLeafSummary(filteredData)}`);

    renderTable(filteredData);

    // 기존 승패 선 레이어
    const lines = svg.selectAll(".line")
      .data(filteredData)
      .enter()
      .append("path")
      .attr("class", "line")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", d => getLineColor(d))
      .attr("stroke-width", lineWidth)
      .attr("opacity", lineOpacity)
      .style("mix-blend-mode", "normal")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke-width", Math.max(lineWidth + 1.4, 2.2))
          .attr("opacity", 0.95);

        tooltip
          .style("opacity", 1)
          .html(makeTooltipHtml(d));
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px");
      })
      .on("mouseout", function() {
        updateBrushDisplay();
        tooltip.style("opacity", 0);
      });

    // Rank 브러싱 시 노란색 보조선 전용 레이어
    const rankOverlayGroup = svg.append("g")
      .attr("class", "rank-overlay-group")
      .style("pointer-events", "none");

    function drawRankOverlay(rows) {
      const overlayLines = rankOverlayGroup
        .selectAll(".rank-highlight-line")
        .data(rows, d => d.__rowId);

      overlayLines.exit().remove();

      overlayLines
        .enter()
        .append("path")
        .attr("class", "rank-highlight-line")
        .attr("fill", "none")
        .merge(overlayLines)
        .attr("d", path)
        .attr("stroke", RANK_HIGHLIGHT_COLOR)
        .attr("stroke-width", RANK_HIGHLIGHT_WIDTH)
        .attr("opacity", RANK_HIGHLIGHT_OPACITY)
        .style("mix-blend-mode", "normal");
    }

    // 승률 표시 전용 레이어
    const winRateGroup = svg.append("g")
      .attr("class", "win-rate-group")
      .style("pointer-events", "none");

    function updateWinRateIndicator(rows) {
      const winRate = calculateWinRate(rows);
      const yPos = y[WIN_RATE_DIMENSION](winRate);
      const xPos = getX(WIN_RATE_DIMENSION);
      const displayValue = Math.round(winRate);

      winRateGroup.selectAll("*").remove();

      winRateGroup.append("line")
        .attr("x1", xPos - 48)
        .attr("x2", xPos + 48)
        .attr("y1", yPos)
        .attr("y2", yPos)
        .attr("stroke", WIN_RATE_COLOR)
        .attr("stroke-width", WIN_RATE_LINE_WIDTH)
        .attr("opacity", 0.95);

      winRateGroup.append("circle")
        .attr("cx", xPos)
        .attr("cy", yPos)
        .attr("r", 7)
        .attr("fill", WIN_RATE_COLOR)
        .attr("opacity", 0.95);

      winRateGroup.append("text")
        .attr("x", xPos + 62)
        .attr("y", yPos + 8)
        .attr("text-anchor", "start")
        .style("font-size", FONT_SIZE.winRateLabel)
        .style("font-weight", "bold")
        .style("fill", WIN_RATE_COLOR)
        .text(`${displayValue}%`);
    }

    const axes = svg.selectAll(".axis")
      .data(dimensions)
      .enter()
      .append("g")
      .attr("class", "axis")
      .attr("transform", d => `translate(${getX(d)})`)
      .each(function(dim) {
        if (numericDimensions.includes(dim)) {
          if (dim === WIN_RATE_DIMENSION) {
            d3.select(this).call(d3.axisLeft(y[dim]).tickValues([0, 20, 40, 60, 80, 100]));
          } else {
            d3.select(this).call(d3.axisLeft(y[dim]).ticks(8));
          }
        } else {
          d3.select(this).call(d3.axisLeft(y[dim]));
        }

        d3.select(this)
          .selectAll("text")
          .style("font-size", FONT_SIZE.axisTick)
          .style("font-weight", "500");

        d3.select(this)
          .selectAll("path, line")
          .style("stroke-width", "1.4px");
      });

    axes.append("text")
      .attr("y", -28)
      .attr("text-anchor", "middle")
      .style("fill", d => d === WIN_RATE_DIMENSION ? WIN_RATE_COLOR : "black")
      .style("font-size", FONT_SIZE.axisTitle)
      .style("font-weight", "bold")
      .text(d => d === WIN_RATE_DIMENSION ? "WinRate(%)" : d);

    numericDimensions.forEach(dim => {
      if (!splitLines[dim]) return;

      const axisGroup = svg.append("g")
        .attr("class", "split-line-group")
        .attr("transform", `translate(${getX(dim)},0)`);

      splitLines[dim].forEach(value => {
        const yPos = y[dim](value);

        axisGroup.append("line")
          .attr("x1", -24)
          .attr("x2", 24)
          .attr("y1", yPos)
          .attr("y2", yPos)
          .attr("stroke", "#222")
          .attr("stroke-width", 1.4)
          .attr("stroke-dasharray", "4 3")
          .attr("opacity", 0.85);

        axisGroup.append("text")
          .attr("x", 32)
          .attr("y", yPos + 6)
          .style("font-size", FONT_SIZE.splitLabel)
          .style("font-weight", "bold")
          .style("fill", "#222")
          .text(value);
      });
    });

    const activeBrushes = {};

    function rowMatchesBrushes(d, ignoreDim = null) {
      return brushDimensions.every(dim => {
        if (dim === ignoreDim) {
          return true;
        }

        const condition = activeBrushes[dim];

        if (!condition) {
          return true;
        }

        if (numericDimensions.includes(dim)) {
          const [min, max] = condition;
          const originalValue = getOriginalValue(dim, d);

          return originalValue >= min && originalValue <= max;
        }

        if (categoricalDimensions.includes(dim)) {
          return condition.includes(String(d[dim]));
        }

        return true;
      });
    }

    function getVisibleRows() {
      return filteredData.filter(d => rowMatchesBrushes(d));
    }

    function getBackgroundRowsWhenRankBrushActive() {
      return filteredData.filter(d => rowMatchesBrushes(d, "Rank"));
    }

    function updateBrushDisplay() {
      const hasRankBrush = Boolean(activeBrushes.Rank);

      const visibleRows = getVisibleRows();
      const visibleIds = new Set(visibleRows.map(d => d.__rowId));

      if (hasRankBrush) {
        const backgroundRows = getBackgroundRowsWhenRankBrushActive();
        const backgroundIds = new Set(backgroundRows.map(d => d.__rowId));

        // 기존 파란색/빨간색 선은 그대로 유지
        lines
          .attr("display", d => backgroundIds.has(d.__rowId) ? null : "none")
          .attr("stroke", d => getLineColor(d))
          .attr("opacity", Math.min(lineOpacity + 0.08, 0.36))
          .attr("stroke-width", lineWidth)
          .style("mix-blend-mode", "normal");

        // Rank 브러싱에 해당하는 선만 얇은 노란색 보조선으로 추가 표시
        drawRankOverlay(visibleRows);
      } else {
        lines
          .attr("display", d => visibleIds.has(d.__rowId) ? null : "none")
          .attr("stroke", d => getLineColor(d))
          .attr("opacity", Math.min(lineOpacity + 0.15, 0.55))
          .attr("stroke-width", lineWidth + 0.15)
          .style("mix-blend-mode", "normal");

        drawRankOverlay([]);
      }

      updateWinRateIndicator(visibleRows);

      info
        .style("font-size", FONT_SIZE.info)
        .style("font-weight", "600")
        .style("margin", "12px 0")
        .text(`현재 표시 데이터: ${visibleRows.length}개 | ${buildLeafSummary(visibleRows)}`);

      renderTable(visibleRows);
    }

    axes
      .filter(dim => dim !== WIN_RATE_DIMENSION)
      .append("g")
      .attr("class", "brush")
      .each(function(dim) {
        const brush = d3.brushY()
          .extent([[-18, 0], [18, height]])
          .on("brush end", function(event) {
            if (event.selection === null) {
              delete activeBrushes[dim];
              updateBrushDisplay();
              return;
            }

            const [y0, y1] = event.selection;
            const top = Math.min(y0, y1);
            const bottom = Math.max(y0, y1);

            if (numericDimensions.includes(dim)) {
              const v0 = y[dim].invert(bottom);
              const v1 = y[dim].invert(top);

              activeBrushes[dim] = [Math.min(v0, v1), Math.max(v0, v1)];
            }

            if (categoricalDimensions.includes(dim)) {
              const selectedCategories = categoricalDomains[dim].filter(value => {
                const pos = y[dim](value);

                return pos >= top && pos <= bottom;
              });

              if (selectedCategories.length === 0) {
                delete activeBrushes[dim];
              } else {
                activeBrushes[dim] = selectedCategories;
              }
            }

            updateBrushDisplay();
          });

        d3.select(this).call(brush);
      });

    updateBrushDisplay();
  }

  function updateChart() {
    const selectedSeason = seasonFilter.empty() ? "all" : seasonFilter.property("value");
    const selectedTeam = teamFilter.empty() ? "all" : teamFilter.property("value");
    const selectedRank = rankFilter.empty() ? "all" : rankFilter.property("value");
    const selectedResult = resultFilter.empty() ? "all" : resultFilter.property("value");
    const selectedLeafNode = leafNodeFilter.empty() ? "all" : leafNodeFilter.property("value");
    const selectedOutcomeType = outcomeTypeFilter.empty() ? "all" : outcomeTypeFilter.property("value");

    const filteredData = data.filter(d => {
      const seasonMatch = selectedSeason === "all" || String(d.Season) === selectedSeason;
      const teamMatch = selectedTeam === "all" || String(d.Team) === selectedTeam;
      const rankMatch = selectedRank === "all" || String(d.Rank) === selectedRank;
      const resultMatch = selectedResult === "all" || String(d.Result) === selectedResult;
      const leafMatch = selectedLeafNode === "all" || String(d.LeafNode) === selectedLeafNode;
      const outcomeMatch = selectedOutcomeType === "all" || String(d.OutcomeType) === selectedOutcomeType;

      return seasonMatch && teamMatch && rankMatch && resultMatch && leafMatch && outcomeMatch;
    });

    drawChart(filteredData);
  }

  if (!seasonFilter.empty()) seasonFilter.on("change", updateChart);
  if (!teamFilter.empty()) teamFilter.on("change", updateChart);
  if (!rankFilter.empty()) rankFilter.on("change", updateChart);
  if (!resultFilter.empty()) resultFilter.on("change", updateChart);
  if (!leafNodeFilter.empty()) leafNodeFilter.on("change", updateChart);
  if (!outcomeTypeFilter.empty()) outcomeTypeFilter.on("change", updateChart);

  updateChart();
});