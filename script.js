const margin = { top: 50, right: 50, bottom: 30, left: 50 };
const width = 2200 - margin.left - margin.right;
const height = 720 - margin.top - margin.bottom;

const chartContainer = d3.select("#chart");
const tooltip = d3.select("#tooltip");
const info = d3.select("#info");

d3.csv("kbl.csv", d3.autoType).then(data => {
  console.log("불러온 데이터:", data);
  console.log("컬럼명:", data.columns);

  // 메타 축(범주형)
  const categoricalDimensions = [
    "Season",
    "Result",
    "Team",
    "Rank"
  ];

  // 수치형 축
  const numericDimensions = [
    "TotScore",
    "RB",
    "AS",
    "ST",
    "TO",
    "OFFRTG",
    "DEFRTG",
    "NETRTG",
    "EFGRatio",
    "PACE"
  ];

  const dimensions = [...categoricalDimensions, ...numericDimensions];

  const seasonFilter = d3.select("#seasonFilter");
  const resultFilter = d3.select("#resultFilter");
  const teamFilter = d3.select("#teamFilter");
  const rankFilter = d3.select("#rankFilter");

  // ----------------------------
  // 상단 필터 채우기
  // ----------------------------
  const seasons = [...new Set(data.map(d => String(d.Season)))].sort();
  seasons.forEach(season => {
    seasonFilter.append("option")
      .attr("value", season)
      .text(season);
  });

  const results = [...new Set(data.map(d => String(d.Result)))].sort();
  results.forEach(result => {
    resultFilter.append("option")
      .attr("value", result)
      .text(result);
  });

  const teams = [...new Set(data.map(d => String(d.Team)))].sort();
  teams.forEach(team => {
    teamFilter.append("option")
      .attr("value", team)
      .text(team);
  });

  const ranks = [...new Set(data.map(d => String(d.Rank)))].sort((a, b) => Number(a) - Number(b));
  ranks.forEach(rank => {
    rankFilter.append("option")
      .attr("value", rank)
      .text(rank);
  });

  // ----------------------------
  // 차트 그리기
  // ----------------------------
  function drawChart(filteredData) {
    chartContainer.selectAll("*").remove();

    const svg = chartContainer
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint()
      .domain(dimensions)
      .range([0, width])
      .padding(0.5);

    const y = {};
    const categoricalDomains = {};

    // 범주형 축 scale
    categoricalDimensions.forEach(dim => {
      const domainValues = [...new Set(data.map(d => String(d[dim])))];

      if (dim === "Season") {
        domainValues.sort();
      } else if (dim === "Rank") {
        domainValues.sort((a, b) => Number(a) - Number(b));
      } else {
        domainValues.sort();
      }

      categoricalDomains[dim] = domainValues;

      y[dim] = d3.scalePoint()
        .domain(domainValues)
        .range([height, 0]);
    });

    // 수치형 축 scale
    numericDimensions.forEach(dim => {
      y[dim] = d3.scaleLinear()
        .domain(d3.extent(data, d => d[dim]))
        .range([height, 0]);
    });

    function getY(dim, d) {
      if (categoricalDimensions.includes(dim)) {
        return y[dim](String(d[dim]));
      }
      return y[dim](d[dim]);
    }

    function path(d) {
      return d3.line()(
        dimensions.map(dim => [x(dim), getY(dim, d)])
      );
    }

    info.text(`현재 표시 데이터: ${filteredData.length}개`);

    const lines = svg.selectAll(".line")
      .data(filteredData)
      .enter()
      .append("path")
      .attr("class", "line")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", d => String(d.Result) === "win" ? "steelblue" : "tomato")
      .attr("stroke-width", 1)
      .attr("opacity", 0.25)
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke-width", 3)
          .attr("opacity", 0.9);

        tooltip
          .style("opacity", 1)
          .html(`
            Season: ${d.Season}<br>
            Team: ${d.Team}<br>
            Result: ${d.Result}<br>
            Rank: ${d.Rank}<br>
            TotScore: ${d.TotScore}<br>
            RB: ${d.RB}<br>
            AS: ${d.AS}<br>
            ST: ${d.ST}<br>
            TO: ${d.TO}<br>
            OFFRTG: ${d.OFFRTG}<br>
            DEFRTG: ${d.DEFRTG}<br>
            NETRTG: ${d.NETRTG}<br>
            EFGRatio: ${d.EFGRatio}<br>
            PACE: ${d.PACE}
          `);
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("stroke-width", 1)
          .attr("opacity", 0.25);

        tooltip.style("opacity", 0);
      });

    const axes = svg.selectAll(".axis")
      .data(dimensions)
      .enter()
      .append("g")
      .attr("class", "axis")
      .attr("transform", d => `translate(${x(d)})`)
      .each(function(dim) {
        d3.select(this).call(d3.axisLeft(y[dim]));
      });

    axes.append("text")
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("fill", "black")
      .style("font-weight", "bold")
      .text(d => d);

    // 브러시 선택 상태 저장
    const activeBrushes = {};

    function updateBrushDisplay() {
      let visibleCount = 0;

      lines
        .attr("display", d => {
          const visible = dimensions.every(dim => {
            const condition = activeBrushes[dim];
            if (!condition) return true;

            // 수치형 축
            if (numericDimensions.includes(dim)) {
              const [min, max] = condition;
              return d[dim] >= min && d[dim] <= max;
            }

            // 범주형 축
            if (categoricalDimensions.includes(dim)) {
              return condition.includes(String(d[dim]));
            }

            return true;
          });

          if (visible) visibleCount += 1;
          return visible ? null : "none";
        })
        .attr("opacity", 0.9)
        .attr("stroke-width", 2);

      info.text(`현재 표시 데이터: ${visibleCount}개`);
    }

    // 모든 축에 브러시 적용
    axes.append("g")
      .attr("class", "brush")
      .each(function(dim) {
        const brush = d3.brushY()
          .extent([[-12, 0], [12, height]])
          .on("brush end", function(event) {
            if (event.selection === null) {
              delete activeBrushes[dim];
              updateBrushDisplay();
              return;
            }

            const [y0, y1] = event.selection;
            const top = Math.min(y0, y1);
            const bottom = Math.max(y0, y1);

            // 수치형 축
            if (numericDimensions.includes(dim)) {
              const v0 = y[dim].invert(bottom);
              const v1 = y[dim].invert(top);
              activeBrushes[dim] = [Math.min(v0, v1), Math.max(v0, v1)];
            }

            // 범주형 축
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

            console.log("현재 브러시 상태:", activeBrushes);
            updateBrushDisplay();
          });

        d3.select(this).call(brush);
      });
  }

  // ----------------------------
  // 상단 필터 반영
  // ----------------------------
  function updateChart() {
    const selectedSeason = seasonFilter.property("value");
    const selectedResult = resultFilter.property("value");
    const selectedTeam = teamFilter.property("value");
    const selectedRank = rankFilter.property("value");

    const filteredData = data.filter(d => {
      const seasonMatch = selectedSeason === "all" || String(d.Season) === selectedSeason;
      const resultMatch = selectedResult === "all" || String(d.Result) === selectedResult;
      const teamMatch = selectedTeam === "all" || String(d.Team) === selectedTeam;
      const rankMatch = selectedRank === "all" || String(d.Rank) === selectedRank;

      return seasonMatch && resultMatch && teamMatch && rankMatch;
    });

    console.log("선택된 시즌:", selectedSeason);
    console.log("선택된 결과:", selectedResult);
    console.log("선택된 팀:", selectedTeam);
    console.log("선택된 순위:", selectedRank);
    console.log("필터 후 데이터 개수:", filteredData.length);

    drawChart(filteredData);
  }

  seasonFilter.on("change", updateChart);
  resultFilter.on("change", updateChart);
  teamFilter.on("change", updateChart);
  rankFilter.on("change", updateChart);

  updateChart();
});