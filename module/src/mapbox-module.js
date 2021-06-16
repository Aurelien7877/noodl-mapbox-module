const Noodl = require('@noodl/noodl-sdk');
import {useRef, useEffect} from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as turf from '@turf/turf'

import MapboxDraw from "@mapbox/mapbox-gl-draw";
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

//import the css using webpack
//a very simple react component that tells the caller when it's <div> is mounted and unmounted
//defaults to 100% width and height, so wrap in a Group in Noodl to get control over margins, dimensions, etc

function DivComponent(props) {
	const ref = useRef(null);

	useEffect(() => {
		props.onDidMount(ref.current);
		return () => props.onWillUnmount(ref.current);
	});
	const {style, ...otherProps} = props;
	return <div {...otherProps} style={{...{width: '100%', height: '100%'}, ...style}} ref={ref} />;
	}

	const MapboxNode = Noodl.defineReactNode({
		name: 'Mapbox Map',
		category: 'Mapbox',
		getReactComponent() {
			return DivComponent;
	},

	initialize() {
		//wait for the div to mount before we create the map instance
		this.props.onDidMount = domElement => {
			this.initializeMap(domElement);
		};
		this.props.onWillUnmount = () => {
			this.map.remove();
		}
	},

	methods: {

		initializeMap(domElement) {
			const accessToken = Noodl.getProjectSettings().mapboxAccessToken;
			if(!accessToken) {
				//present a warning in the editor
				this.sendWarning('access-token-missing', 'No access token. Please specify one in project settings and reload');
			}
			else {
				//clear any previous warnings, if any
				this.clearWarnings();
			}
			//CRéation constante MAP
			mapboxgl.accessToken = accessToken;
			const map = new mapboxgl.Map({
				container: domElement,
				style: this.inputs.mapboxStyle || 'mapbox://styles/mapbox/streets-v11',
				center: [this.inputs.longitude || 0, this.inputs.latitude || 0],
				zoom: this.inputs.zoom || 0,
				interactive: this.inputs.interactive
			});
			this.map = map;

			const draw = new MapboxDraw({
			displayControlsDefault: false,
			controls: {
			polygon: true,
			trash: true
			},
			defaultMode: 'draw_polygon'
			});
			map.addControl(draw);

			map.on('draw.create', updateArea);
			map.on('draw.delete', updateArea);
			map.on('draw.update', updateArea);

			function updateArea(e) {
					var data = draw.getAll();
					var answer = document.getElementById('calculated-area');
					if (data.features.length > 0) {
								var area = turf.area(data);
								// restrict to area to 2 decimal points
								var rounded_area = Math.round(area * 100) / 100;
								answer.innerHTML =
								'<p><strong>' +
								rounded_area +
								'</strong></p><p>square meters</p>';
							} else {
							answer.innerHTML = '';
							if (e.type !== 'draw.delete')
							alert('Use the draw tools to draw a polygon!');
							}
				}

			map.on('move', () => {
				this.setOutputs({
					longitude: map.getCenter().lng.toFixed(4),
					latitude: map.getCenter().lat.toFixed(4),
					zoom: map.getZoom().toFixed(2)
				})
			});

			//Fonction de géolocalisation
			this.geolocate = new mapboxgl.GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true
				},
				trackUserLocation: true
			});

			//Fonction pour ajouter un pin
			function addPin(long, lat) {
				var marker = new mapboxgl.Marker()
					.setLngLat([long, lat])
					.addTo(this.map);
			};
			this.addPin = addPin;
			
			//Fonction pour faire apparaitre un PopUp
			function popUp(long,lat) {
				var fenetre = new mapboxgl.Popup()
				.setLngLat([long,lat])
				.setHTML("<h1>Coord. : "+ long +" ," + lat+ "</h1>")
				.addTo(this.map);
			}
			this.popUp=popUp;

			//Fonction qui change le style de la carte
			function styleChange(style) {

				this.inputs.mapboxStyle='mapbox://styles/mapbox/satellite-v9'
			}
			this.styleChange = styleChange;

			//Fonction pour centrer
			function flyTo(long, lat) {
				this.map.flyTo({
					center: [long, lat],
					essential: true
					});
			}
			this.flyTo = flyTo;

			//Fonction pour zommer, dézoomrer et rotation
			function controlMenu() {
				// Add zoom and rotation controls to the map.
				map.addControl(new mapboxgl.NavigationControl());
			}
			this.controlMenu=controlMenu;

			//Fonction pour naviguer fleche
			function navigate() {
				// pixels the map pans when the up or down arrow is clicked
				var deltaDistance = 100;

				// degrees the map rotates when the left or right arrow is clicked
				var deltaDegrees = 25;
			
				function easing(t) {
					return t * (2 - t);
				}
			
				map.on('load', function () {
					map.getCanvas().focus();
			
					map.getCanvas().addEventListener(
						'keydown',
						function (e) {
							e.preventDefault();
							if (e.which === 38) {
								// up
								map.panBy([0, -deltaDistance], {
									easing: easing
								});
							} else if (e.which === 40) {
								// down
								map.panBy([0, deltaDistance], {
									easing: easing
								});
							} else if (e.which === 37) {
								// left
								map.easeTo({
									bearing: map.getBearing() - deltaDegrees,
									easing: easing
								});
							} else if (e.which === 39) {
								// right
								map.easeTo({
									bearing: map.getBearing() + deltaDegrees,
									easing: easing
								});
							}
						},
						true
					);
				})
			}
			this.navigate=navigate;



			map.addControl(this.geolocate);

			map.on('load', () => {
				this.sendSignalOnOutput("mapLoaded");
			});
		}
	},

	inputs: {
		//options
		mapboxStyle: {
			displayName: 'Style',
			group: 'Options',
			type: 'string',
			default: 'mapbox://styles/mapbox/streets-v11'
		},
		interactive: {displayName: 'Interactive', type: 'boolean', default: true},

		//coordinates and zoom
		longitude: {displayName: 'Longitude', type: 'number', group: 'Coordinates', default: 0},
		latitude: {displayName: 'Latitude', type: 'number', group: 'Coordinates', default: 0},
		zoom: {displayName: 'Zoom', type: 'number', group: 'Coordinates', default: 0},
	},

	signals: {
		centerOnUser: {
			displayName: 'Center on user',
			group: 'Actions',
			signal() {
				this.geolocate && this.geolocate.trigger();
			},
		},
		addPin: {
			displayName: 'Add pin to map',
			group: 'Actions',
			signal() {
				this.addPin(this.inputs.longitude, this.inputs.latitude);
			}
		},

		flyTo: {
			displayName: 'Pan to location',
			group: 'Actions',
			signal() {
				this.flyTo(this.inputs.longitude, this.inputs.latitude);
			}
		},

		popUp: {
			displayName: 'Popup Coords',
			group: 'Actions',
			signal() {
				this.popUp(this.inputs.longitude,this.inputs.latitude);
			}
		},

		styleChange: {
			displayName: 'Change to satellite view',
			group: 'Actions',
			signal() {
				this.styleChange(this.inputs.mapboxStyle);
			}
		},

		controlMenu: {
			displayName: '',
			group: 'Actions',
			signal() {
				this.addPin(this.inputs.longitude, this.inputs.latitude);
			}
		},

		navigate: {
			displayName: 'naviguate with -> <-',
			group: 'Actions',
			signal() {
				this.navigate();
			}
		},
	},

	outputs: {
		longitude: {displayName: 'Longitude', type: 'number', group: 'Coordinates'},
		latitude: {displayName: 'Latitude', type: 'number', group: 'Coordinates'},
		zoom: {displayName: 'Longitude', type: 'number', group: 'Coordinates'},
		mapLoaded: {displayName: 'Map Loaded', type: 'signal'}
	},

	outputProps: {
		onClick: {type: 'signal', displayName: 'Click'}
	}
})

Noodl.defineModule({
    reactNodes: [
    	MapboxNode
    ],
    nodes:[
	],
	settings: [{
		name: 'mapboxAccessToken',
		type: 'string',
		displayName: 'Mapbox Access Token',
		plug: 'input'
	}],
    setup() {

    }
});
